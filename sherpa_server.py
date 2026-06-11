#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sherpa-ONNX ASR 服務器
使用 ONNX Runtime 進行高速離線語音識別
比 FunASR PyTorch 版本快 10+ 倍，記憶體省 75%
"""

import sys
import json
import os
import logging
import traceback
import signal
import tempfile
import wave
import numpy as np

# 簡轉繁轉換器
logger_init = logging.getLogger(__name__)
try:
    from opencc import OpenCC
    try:
        _opencc_converter = OpenCC('s2tw')  # 簡體→繁體（台灣標準字，吃不會變喫）
    except Exception:
        _opencc_converter = OpenCC('s2t')   # 沒有 s2tw 配置時退回 s2t
except Exception as _e:
    _opencc_converter = None
    logger_init.warning(f"OpenCC 不可用，將不進行簡轉繁轉換: {_e}")

def to_traditional(text):
    """將簡體中文轉換為繁體中文"""
    if not text or _opencc_converter is None:
        return text
    try:
        return _opencc_converter.convert(text)
    except Exception:
        return text


def normalize_ascii_width(text):
    """全形英文字母 / 數字 → 半形（不動中文與全形標點，避免破壞，。？）"""
    if not text:
        return text
    out = []
    for ch in text:
        code = ord(ch)
        if 0xFF10 <= code <= 0xFF19 or 0xFF21 <= code <= 0xFF3A or 0xFF41 <= code <= 0xFF5A:
            out.append(chr(code - 0xFEE0))  # 全形數字/字母 → 半形
        else:
            out.append(ch)
    return ''.join(out)


# 有效疊字白名單（AA 形式，含簡繁）。不在名單內的連續重複中文字 → 視為口吃收成 1 個。
_VALID_REDUP = set((
    # 家庭稱謂
    "爸爸 妈妈 媽媽 爹爹 哥哥 姐姐 弟弟 妹妹 爷爷 爺爺 奶奶 公公 婆婆 叔叔 婶婶 嬸嬸 伯伯 姑姑 舅舅 姨姨 宝宝 寶寶 乖乖 囡囡 妞妞 弟弟 哥哥 "
    # 動作（看一看）
    "看看 想想 试试 試試 走走 说说 說說 讲讲 講講 聊聊 玩玩 等等 找找 问问 問問 摸摸 抱抱 亲亲 親親 拍拍 数数 數數 闻闻 聞聞 尝尝 嚐嚐 写写 寫寫 读读 讀讀 算算 比比 量量 翻翻 查查 学学 學學 练练 練練 唱唱 跳跳 笑笑 猜猜 瞧瞧 望望 听听 聽聽 坐坐 站站 歇歇 动动 動動 转转 轉轉 晃晃 逛逛 试试 摇摇 搖搖 "
    # 副詞
    "慢慢 快快 刚刚 剛剛 常常 偏偏 渐渐 漸漸 轻轻 輕輕 重重 默默 悄悄 纷纷 紛紛 久久 早早 迟迟 遲遲 连连 連連 频频 頻頻 屡屡 屢屢 苦苦 深深 浅浅 淺淺 远远 遠遠 近近 团团 團團 牢牢 死死 紧紧 緊緊 松松 鬆鬆 稳稳 穩穩 偷偷 暗暗 明明 空空 满满 滿滿 处处 處處 时时 時時 步步 层层 層層 点点 點點 滴滴 一一 "
    # 量詞/名詞
    "个个 個個 条条 條條 件件 种种 種種 样样 樣樣 天天 年年 月月 日日 夜夜 人人 家家 户户 戶戶 村村 区区 區區 场场 場場 "
    # 形容
    "好好 多多 少少 大大 小小 长长 長長 短短 胖胖 瘦瘦 圆圆 圓圓 扁扁 红红 紅紅 绿绿 綠綠 蓝蓝 藍藍 黄黄 黃黃 黑黑 白白 亮亮 甜甜 酸酸 辣辣 咸咸 鹹鹹 香香 臭臭 暖暖 凉凉 涼涼 热热 熱熱 冷冷 软软 軟軟 硬硬 厚厚 薄薄 嫩嫩 脆脆 高高 低低 矮矮 满满 "
    # 語氣/擬聲（含語助詞疊用）
    "谢谢 謝謝 拜拜 嗯嗯 哈哈 呵呵 嘿嘿 嘻嘻 哼哼 喵喵 汪汪 咚咚 叮叮 啦啦 唉唉 哎哎 "
    "呀呀 啊啊 哇哇 哦哦 喔喔 嗚嗚 噢噢 咦咦"
).split())


def _is_cjk(ch):
    return 0x4E00 <= ord(ch) <= 0x9FFF


def collapse_repeats(text):
    """去除口吃式重複字，但保留有效疊字。
    - XX 在白名單（慢慢、謝謝、看看...）→ 保留 2 個
    - 前或後也是「不同字的疊字」→ 視為 AABB 疊詞（吃吃喝喝、開開心心）→ 保留 2 個
    - 否則視為口吃 → 收成 1 個（吃吃牛肉→吃牛肉、我我→我）
    - 非中文（英文/數字/標點）不動
    """
    if not text:
        return text
    # 先切成連續段 (字, 次數)
    runs = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        j = i
        while j < n and text[j] == ch:
            j += 1
        runs.append((ch, j - i))
        i = j

    out = []
    for k, (ch, run) in enumerate(runs):
        if run >= 2 and _is_cjk(ch):
            prev_dup = k > 0 and runs[k - 1][1] >= 2 and runs[k - 1][0] != ch and _is_cjk(runs[k - 1][0])
            next_dup = k + 1 < len(runs) and runs[k + 1][1] >= 2 and runs[k + 1][0] != ch and _is_cjk(runs[k + 1][0])
            if (ch + ch) in _VALID_REDUP or prev_dup or next_dup:
                out.append(ch * 2)   # 有效疊字 / AABB 疊詞 → 保留 2
            else:
                out.append(ch)       # 口吃 → 收成 1
        else:
            out.append(ch * run)
    return ''.join(out)


def merge_spaced_letters(text):
    """合併被空白拆開的單一英文字母（Paraformer 常把英文逐字母吐出：
    "h e n t" → "hent"），但保留正常的英文詞間空白（"hello world" 不動）。
    """
    if not text or ' ' not in text:
        return text
    import re
    # 連續的「單一字母 + 空白」序列 → 去掉中間空白（用 ASCII lookaround，
    # 不用 \b，因為中文也算 word char 會誤判，導致 開h 連在一起時抓不到 h）
    return re.sub(
        r'(?<![A-Za-z])([A-Za-z](?: [A-Za-z])+)(?![A-Za-z])',
        lambda m: m.group(1).replace(' ', ''),
        text
    )


# 常見發語詞 / 口頭禪：連續重複（即使只重複 2 次）多半是口吃，收成 1 次。
_FILLER_WORDS = ["其實", "然後", "就是", "那個", "這個", "反正", "所以",
                 "可是", "但是", "不過", "而且", "對啊", "對對", "那就", "之類"]


def collapse_phrase_repeats(text):
    """去除「詞組」層級的口吃重複：
    - 任何 2~4 字詞連續重複 3 次以上 → 收成 1 次（其實其實其實 → 其實）
    - 發語詞（_FILLER_WORDS）連續重複 2 次以上 → 收成 1 次（然後然後 → 然後）
    - 一般 2 字詞剛好重複 2 次（快樂快樂）暫不處理，避免誤刪正常疊詞（研究研究）
    """
    if not text:
        return text
    import re
    # 1) 任意 2~4 字詞重複 3+ 次 → 1 次
    text = re.sub(r'([一-鿿]{2,4})\1{2,}', r'\1', text)
    # 2) 發語詞重複 2+ 次 → 1 次
    for w in _FILLER_WORDS:
        text = re.sub(r'(?:' + re.escape(w) + r'){2,}', w, text)
    return text


def normalize_interjections(text):
    """語助詞正規化：哎/誒 → 欸；移除單獨的遲疑語助詞 呃。"""
    if not text:
        return text
    text = text.replace('哎', '欸').replace('誒', '欸')
    text = text.replace('呃', '')
    return text


# 句末片語 → 標點規則。標點模型常漏「！」，這裡用結尾片語補判 ？/！。
# 註：此時文字仍為簡體（to_traditional 在最後才做），故用簡體片語。
_PUNCT_RULES = {
    "？": ["什么啊", "怎么啊", "为什么啊", "可以吗", "好吗", "是不是", "对不对",
           "行不行", "好不好", "要不要", "有没有", "是吗", "对吗", "能不能"],
    "！": ["怎样啦", "这样啦", "干嘛啦", "什么啦", "这样啊", "欸呀呀", "太棒了",
           "好厉害", "真的假的", "不会吧", "天啊", "我的天"],
}


# 句末「單字語助詞」→ 標點（主規則，命中率高）。
# 疑問語氣 → ？；感嘆/驚嘆語氣 → ！。（含簡繁，文字此時為簡體但一併納入）
_END_PARTICLE_PUNCT = {
    '吗': '？', '嗎': '？', '呢': '？',
    '啊': '！', '呀': '！', '啦': '！', '哇': '！',
    '喔': '！', '哦': '！', '噢': '！', '耶': '！', '欸': '！',
}
_PARTICLE_CLASS = '吗嗎呢啊呀啦哇喔哦噢耶欸'


def apply_punct_rules(text):
    """修正句末標點：
    1) 句末單字語助詞（啊→！、吗→？...）—— 主規則
    2) 句末多字片語（对不对→？、真的假的→！...）—— 補充
    只在句末標點（。！？）或字串結尾前作用；句中的「啊，」等逗號不動。
    """
    if not text:
        return text
    import re

    # 1) 句末單字語助詞 + 句末標點 → 換標點
    text = re.sub(
        r'([' + _PARTICLE_CLASS + r'])([。！？])',
        lambda m: m.group(1) + _END_PARTICLE_PUNCT.get(m.group(1), m.group(2)),
        text
    )
    # 句末單字語助詞在字串結尾、沒有標點 → 補上
    text = re.sub(
        r'([' + _PARTICLE_CLASS + r'])$',
        lambda m: m.group(1) + _END_PARTICLE_PUNCT[m.group(1)],
        text
    )

    # 2) 多字片語補充（針對非語助詞結尾，如 对不对 / 是不是）
    for mark, phrases in _PUNCT_RULES.items():
        for p in phrases:
            ep = re.escape(p)
            text = re.sub(ep + r'[。，！？]', p + mark, text)
            text = re.sub(ep + r'$', p + mark, text)
    return text


def format_lists(text):
    """規則式列點排版（免 AI）：偵測「第一…第二…第三…」連續列舉，
    轉成換行的「1. 2. 3.」清單，開頭引言補上冒號。
    觸發條件：以「第一」開頭、>=2 項；排除「第一次/第二次」這種時間詞。
    """
    if not text:
        return text
    import re
    markers = []
    for m in re.finditer(r'第([一二三四五六七八九十兩两])', text):
        after = text[m.end():m.end() + 1]
        if after in '次名件':  # 第一次=次數、第一名=名次、第一件=計數，都不是列點
            continue
        markers.append((m, m.group(1)))
    if len(markers) < 2 or markers[0][1] != '一':
        return text

    intro = text[:markers[0][0].start()].strip().rstrip('，,、：:；; 。　')
    items = []
    for i, (m, _ord) in enumerate(markers):
        start = m.end()
        end = markers[i + 1][0].start() if i + 1 < len(markers) else len(text)
        seg = text[start:end]
        # 去掉項目開頭的「量詞(+名詞)」與連接詞：第一「件事情，」/「個是」/「點，」/「，」…
        seg = re.sub(
            r'^(?:[個个件位種种項项條条張张份步點点] ?)?'
            r'(?:事情|事兒|事儿|事|東西|东西|原因|問題|问题|地方|方面|步驟|步骤)?'
            r'(?:是|為|为|要|就是)?[，,、：:。　\s]*',
            '', seg)
        seg = seg.strip().rstrip('。，,、；;　 ')
        if seg:
            items.append(seg)
    if len(items) < 2:
        return text

    body = '\n'.join(f'{i + 1}. {it}' for i, it in enumerate(items))
    return (intro + '：\n' + body) if intro else body


def clean_transcript(text):
    """辨識前清理（標點之前）：全形→半形 + 合併英文 + 去口吃 + 語助詞正規化"""
    if not text:
        return text
    text = normalize_ascii_width(text)
    text = merge_spaced_letters(text)
    text = collapse_repeats(text)
    text = collapse_phrase_repeats(text)
    text = normalize_interjections(text)
    return text

# 設置日誌
def get_log_path():
    if "ELECTRON_USER_DATA" in os.environ:
        log_dir = os.path.join(os.environ["ELECTRON_USER_DATA"], "logs")
    else:
        log_dir = os.path.join(tempfile.gettempdir(), "ququ_logs")
    os.makedirs(log_dir, exist_ok=True)
    return os.path.join(log_dir, "sherpa_server.log")

log_file_path = get_log_path()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(log_file_path, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)
logger.info(f"Sherpa-ONNX 服務器日誌文件: {log_file_path}")


def add_punctuation(text):
    """
    基於規則的簡易中文標點恢復
    使用連接詞分句 + 語氣詞 + 句末標點
    """
    if not text or not text.strip():
        return text

    import re
    text = text.strip()

    # 問句結尾詞（在句末時表示疑問）
    question_endings = ['嗎', '吗', '呢', '麼', '么']

    # 疑問詞（出現在文中表示疑問句）
    question_words = [
        '什麼', '什么', '怎麼', '怎么', '為什麼', '为什么',
        '哪裡', '哪里', '哪個', '哪个', '誰', '谁',
        '幾個', '几个', '多少', '是否', '能否', '可否',
        '有沒有', '有没有', '是不是', '會不會', '会不会',
        '怎樣', '怎样', '如何', '為何', '为何',
    ]

    # === 在這些詞【後面】加逗號 ===
    # 語氣詞（後面加逗號）
    particles_after = [
        '嘛', '啦', '呀', '囉', '咯', '噢', '唷',
        '哎', '欸', '啊', '喔', '哦', '嗯', '呃',
    ]

    # 疑問短語（後面加逗號或問號）
    question_phrases_after = [
        '不是嗎', '不是吗', '對不對', '对不对', '是不是',
        '好不好', '行不行', '可不可以', '對吧', '对吧',
        '是吧', '好嗎', '好吗',
    ]

    # === 在這些詞【前面】加逗號 ===
    # 注意：只放「幾乎一定是連接詞」的詞，避免誤判
    # 重要：長詞必須放在短詞前面，否則短詞會先匹配導致長詞被拆開
    sentence_starters = [
        # 「可」開頭的轉折（「可每當」「可每次」移到結構性斷句處理，避免衝突）
        '可現在', '可现在', '可他', '可她', '可我', '可你',
        '可這', '可这', '可那', '可誰', '可谁', '可當', '可当',
        # 長詞優先（這些很安全）
        '換句話說', '换句话说', '例如說', '例如说', '比如說', '比如说',
        '沒想到', '没想到', '想不到', '不是嗎', '不是吗',
        '要不是', '此時此刻', '此时此刻',
        # 轉折/連接（常用且安全的）
        '然後', '然后', '接著', '接着', '之後', '之后',
        '所以', '但是', '不過', '不过', '可是',
        '而且', '並且', '并且', '或者', '還是', '还是',
        '雖然', '虽然', '即使',
        '首先', '其次', '最後', '最后', '另外', '此外',
        '總之', '总之', '反正', '難怪', '难怪',
        '其實', '其实', '原來', '原来', '後來', '后来',
        '不然', '否則', '否则',
        '於是', '于是',
        '畢竟', '毕竟', '終於', '终于',
        '當然', '当然', '幸好', '幸虧', '幸亏',
        '竟是', '竟然', '居然',
        # 轉折代詞（這些很安全）
        '而他', '而她', '而我', '而你', '而它',
        '但他', '但她', '但我', '但你', '但它',
        # 強調詞
        '至少', '起碼', '起码',
        # 主詞+副詞（新句子開頭的強信號）
        # X就
        '我就', '你就', '他就', '她就', '它就',
        '我們就', '我们就', '你們就', '你们就', '他們就', '他们就',
        # X也
        '我也', '你也', '他也', '她也', '它也',
        '我們也', '我们也', '你們也', '你们也', '他們也', '他们也',
        # X又
        '我又', '你又', '他又', '她又', '它又',
        # X才
        '我才', '你才', '他才', '她才', '它才',
        # X都
        '我都', '你都', '他都', '她都', '它都',
        # X會/要/能/可
        '我會', '我会', '你會', '你会', '他會', '他会', '她會', '她会',
        '我要', '你要', '他要', '她要',
        '我能', '你能', '他能', '她能',
        '我可', '你可', '他可', '她可',
        # X便/正/在
        '我便', '你便', '他便', '她便',
        '我正', '你正', '他正', '她正',
        # 這就/那就
        '這就', '这就', '那就',
        # 讓步/對比
        '卻', '却', '反而', '偏偏',
        # 時間/條件開頭
        '自從', '自从', '直到', '等到', '過了', '过了',
        # 「每次」「每當」容易跟「可每當」衝突，用結構性斷句處理
        '當他', '當她', '當我', '當你', '當它', '当他', '当她', '当我', '当你', '当它',
        # 條件/假設
        '不需要', '不管',
        # 補充說明
        '也沒有', '也没有',
    ]

    # 檢查整段是否為問句
    is_question = any(text.endswith(w) for w in question_endings) or \
                  any(w in text for w in question_words)

    # 注意：移除了短句 early return，因為短句也可能需要斷句
    # 例如「她笑了笑他也跟著笑」只有 9 字但需要斷成「她笑了笑，他也跟著笑」

    result = text

    # 0. 保護複合詞（避免被錯誤斷開）
    # 用特殊標記暫時替換（保護詞不會被內部拆開）
    protected_words = [
        '自然而然', '理所當然', '理所当然', '順其自然', '顺其自然',
        '因此', '為此', '为此',  # 「因此」單獨出現才斷，不是「也沒有因此」
    ]
    for i, word in enumerate(protected_words):
        result = result.replace(word, f'__PROTECTED_{i}__')

    # 1. 在語氣詞後面加逗號
    for word in particles_after:
        # 語氣詞後面如果還有字，就加逗號
        pattern = f'({word})([^，。？！、；：])'
        result = re.sub(pattern, r'\1，\2', result)

    # 2. 在疑問短語後面加逗號
    for phrase in question_phrases_after:
        pattern = f'({phrase})([^，。？！、；：])'
        result = re.sub(pattern, r'\1，\2', result)

    # 3. 在句子連接詞前加逗號
    for word in sentence_starters:
        pattern = f'([^，。？！、；：])({word})'
        result = re.sub(pattern, r'\1，\2', result)

    # 4. 結構性斷句（「當...的時候」「如果...的話」等）
    # 處理順序很重要：長模式先處理，處理後保護，避免短模式拆開

    # 4.1 先處理最長的「可每當...的時候」並保護
    long_patterns = [
        (r'([^，。？！、；：])(可每當[^，。？！、；：]{1,15}的時候)', '可每當', '__KEMEIDANG__'),
        (r'([^，。？！、；：])(可每当[^，。？！、；：]{1,15}的时候)', '可每当', '__KEMEIDANG2__'),
        (r'([^，。？！、；：])(可每次)', '可每次', '__KEMEICI__'),
        (r'([^，。？！、；：])(每當[^，。？！、；：]{1,15}的時候)', '每當', '__MEIDANG__'),
        (r'([^，。？！、；：])(每当[^，。？！、；：]{1,15}的时候)', '每当', '__MEIDANG2__'),
    ]
    for pattern, word, placeholder in long_patterns:
        result = re.sub(pattern, r'\1，\2', result)
        result = result.replace(word, placeholder)

    # 4.2 處理短模式
    short_patterns = [
        r'([^，。？！、；：])(每次)',
        r'([^，。？！、；：])(每回)',
        r'([^，。？！、；：])(當[^，。？！、；：]{1,15}的時候)',
        r'([^，。？！、；：])(当[^，。？！、；：]{1,15}的时候)',
        r'([^，。？！、；：])(如果[^，。？！、；：]{1,15}的話)',
        r'([^，。？！、；：])(如果[^，。？！、；：]{1,15}的话)',
    ]
    for pattern in short_patterns:
        result = re.sub(pattern, r'\1，\2', result)

    # 4.3 還原保護的詞
    for pattern, word, placeholder in long_patterns:
        result = result.replace(placeholder, word)

    # 還原被保護的詞
    for i, word in enumerate(protected_words):
        result = result.replace(f'__PROTECTED_{i}__', word)

    # 清理連續和重複的標點
    result = re.sub(r'，+', '，', result)  # 連續逗號
    result = re.sub(r'。+', '。', result)  # 連續句號
    result = re.sub(r'？+', '？', result)  # 連續問號
    result = re.sub(r'[。，]+(?=[。？])', '', result)  # 句號/逗號後面跟著句號/問號，移除前面的
    result = re.sub(r'。，', '，', result)  # 句號後面逗號，保留逗號
    result = re.sub(r'，。', '。', result)  # 逗號後面句號，保留句號

    # 移除開頭的標點
    result = re.sub(r'^[，。？！]+', '', result)

    # 加上句末標點
    if result and result[-1] not in '，。？！、；：':
        if is_question:
            result += '？'
        else:
            result += '。'

    return result


class SherpaServer:
    def __init__(self, model_dir=None):
        self.recognizer = None  # 離線辨識器 (Paraformer)
        self.streaming_recognizer = None  # 串流辨識器 (Zipformer)
        self.vad = None  # Silero VAD 模型
        self.whisper_recognizer = None  # Whisper small（精準/重辨救援，延遲載入）
        self.punc_model = None  # sherpa-onnx ct-transformer 標點模型
        self.initialized = False
        self.streaming_initialized = False
        self.running = True
        self.transcription_count = 0
        self.total_audio_duration = 0.0
        self.vad_skipped_duration = 0.0  # 被 VAD 跳過的靜音時長

        # 串流會話管理
        self.streaming_sessions = {}  # session_id -> stream object

        # 熱詞設定
        self.hotwords_file = None  # 熱詞檔案路徑
        self.hotwords_score = 1.5  # 熱詞分數 (1.0-3.0)
        self.hotwords_enabled = True  # 是否啟用熱詞

        # 串流 VAD 設定
        self.streaming_vad_enabled = True  # 串流模式啟用 VAD
        self.streaming_vad_threshold = 0.005  # 能量閾值（RMS），調低以捕捉小聲語音
        self.streaming_vad_skipped = 0  # 跳過的 chunk 數
        self.streaming_vad_total = 0  # 總 chunk 數

        # 動態執行緒數：根據 CPU 核心數調整，最多 8 執行緒
        self.num_threads = min(os.cpu_count() or 4, 8)
        logger.info(f"動態執行緒數: {self.num_threads} (CPU 核心: {os.cpu_count()})")

        # 推論提供者 (provider)：cpu / cuda / directml 等
        # 透過環境變數 SHERPA_PROVIDER 控制，預設 cpu。
        # 設為 cuda 可使用 NVIDIA GPU 加速（需安裝 CUDA 版 sherpa-onnx）。
        self.provider = os.environ.get("SHERPA_PROVIDER", "cpu").strip().lower() or "cpu"
        logger.info(f"推論提供者 (provider): {self.provider}")

        # 模型目錄
        self.model_dir = model_dir or self._find_model_dir()
        self.streaming_model_dir = self._find_streaming_model_dir()
        self.punct_model_dir = self._find_punct_model_dir()

        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

    @staticmethod
    def _to_ascii_path(p):
        """sherpa-onnx 在 Windows 無法從含非 ASCII（中文）路徑載入模型
        （會丟 'invalid unordered_map<K,T> key'）。路徑含非 ASCII 時轉成 8.3 短檔名（純 ASCII）。"""
        try:
            if not p or all(ord(c) < 128 for c in p):
                return p
            if os.name == "nt" and os.path.exists(p):
                import ctypes
                buf = ctypes.create_unicode_buffer(32768)
                if ctypes.windll.kernel32.GetShortPathNameW(p, buf, 32768):
                    short = buf.value
                    if short and all(ord(c) < 128 for c in short):
                        return short
        except Exception:
            pass
        return p

    def _poc_sherpa_dir(self):
        """模型根目錄。打包後優先用 userData/models/poc-sherpa（首次下載的位置），
        否則用程式旁的 poc-sherpa（開發 / 後備）。回傳前轉成 ASCII 安全路徑。"""
        result = None
        # 1) 首次下載的位置（userData/models）優先
        user_data = os.environ.get("ELECTRON_USER_DATA")
        if user_data:
            cand = os.path.join(user_data, "models", "poc-sherpa")
            if os.path.isdir(cand):
                result = cand
        # 2) 打包的 exe：模型放在 exe 旁的 poc-sherpa（隨安裝檔附帶）
        if result is None and getattr(sys, "frozen", False):
            cand = os.path.join(os.path.dirname(sys.executable), "poc-sherpa")
            if os.path.isdir(cand):
                result = cand
        # 3) 開發 / 後備：程式旁的 poc-sherpa
        if result is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            result = os.path.join(script_dir, "poc-sherpa")
        return self._to_ascii_path(result)

    def _find_model_dir(self):
        """尋找 sherpa-onnx 離線模型目錄 (Paraformer)"""
        # 優先查找 poc-sherpa 目錄
        poc_model = os.path.join(self._poc_sherpa_dir(), "sherpa-onnx-paraformer-zh-2023-09-14")
        if os.path.exists(poc_model):
            return poc_model

        # 查找用戶緩存目錄
        cache_dir = os.path.expanduser("~/.cache/sherpa-onnx")
        model_name = "sherpa-onnx-paraformer-zh-2023-09-14"
        cache_model = os.path.join(cache_dir, model_name)
        if os.path.exists(cache_model):
            return cache_model

        return poc_model  # 默認返回 poc 路徑

    def _find_streaming_model_dir(self):
        """尋找 sherpa-onnx 串流模型目錄 (Zipformer)"""
        return os.path.join(
            self._poc_sherpa_dir(),
            "sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20"
        )

    def _find_punct_model_dir(self):
        """尋找 sherpa-onnx 標點模型目錄 (ct-transformer)"""
        return os.path.join(
            self._poc_sherpa_dir(),
            "sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12"
        )

    def _signal_handler(self, signum, frame):
        logger.info(f"收到信號 {signum}，準備退出...")
        self.running = False

    def _init_vad(self):
        """初始化 Silero VAD 模型"""
        try:
            import sherpa_onnx

            # 查找 VAD 模型
            vad_model_path = os.path.join(self._poc_sherpa_dir(), "silero_vad.onnx")

            if not os.path.exists(vad_model_path):
                logger.warning(f"Silero VAD 模型不存在: {vad_model_path}，將跳過 VAD")
                self.vad = None
                return

            # 配置 VAD 參數
            vad_config = sherpa_onnx.VadModelConfig()
            vad_config.silero_vad.model = vad_model_path
            vad_config.silero_vad.threshold = 0.4  # 語音檢測閾值（從 0.5 降低，捕捉更多輕聲）
            vad_config.silero_vad.min_silence_duration = 0.25  # 最小靜音時長（秒）
            vad_config.silero_vad.min_speech_duration = 0.15  # 最小語音時長（從 0.25 降低，保留短詞）
            vad_config.silero_vad.max_speech_duration = 15.0  # 最大語音時長（秒）
            vad_config.silero_vad.window_size = 512  # 窗口大小
            vad_config.sample_rate = 16000
            vad_config.num_threads = self.num_threads

            self.vad = sherpa_onnx.VoiceActivityDetector(vad_config, buffer_size_in_seconds=30)
            logger.info("Silero VAD 初始化成功")

        except Exception as e:
            logger.warning(f"Silero VAD 初始化失敗: {e}，將跳過 VAD")
            self.vad = None

    def _extract_speech_segments(self, samples, sample_rate):
        """使用 VAD 提取語音段，跳過靜音"""
        if self.vad is None:
            return samples, 0.0  # 無 VAD，返回原始音頻

        try:
            # 重置 VAD 狀態
            self.vad.reset()

            # 餵入音頻數據
            window_size = 512
            for i in range(0, len(samples), window_size):
                chunk = samples[i:i + window_size]
                if len(chunk) < window_size:
                    # 補零到窗口大小
                    chunk = np.pad(chunk, (0, window_size - len(chunk)), 'constant')
                self.vad.accept_waveform(chunk)

            # 標記輸入結束
            self.vad.flush()

            # 獲取語音段
            speech_segments = []
            while not self.vad.empty():
                segment = self.vad.front
                speech_segments.append(segment)
                self.vad.pop()

            if not speech_segments:
                logger.warning("VAD 未檢測到語音段")
                return samples, 0.0

            # 合併所有語音段
            speech_samples = []
            total_speech_samples = 0
            for seg in speech_segments:
                speech_samples.extend(seg.samples)
                total_speech_samples += len(seg.samples)

            speech_samples = np.array(speech_samples, dtype=np.float32)

            # 計算跳過的靜音時長
            original_duration = len(samples) / sample_rate
            speech_duration = len(speech_samples) / sample_rate
            skipped_duration = original_duration - speech_duration

            logger.info(f"VAD: 原始 {original_duration:.2f}s -> 語音 {speech_duration:.2f}s，跳過 {skipped_duration:.2f}s ({len(speech_segments)} 段)")

            return speech_samples, skipped_duration

        except Exception as e:
            logger.warning(f"VAD 處理失敗: {e}，使用原始音頻")
            return samples, 0.0

    def _transcribe_samples(self, samples, sample_rate, recognizer=None):
        """辨識單一段音訊樣本，回傳原始文字（不含標點/繁簡轉換）。
        可指定 recognizer（如 Whisper），預設用 Paraformer。"""
        rec = recognizer or self.recognizer
        stream = rec.create_stream()
        stream.accept_waveform(sample_rate, samples)
        rec.decode_stream(stream)
        return (stream.result.text or "").strip()

    def _apply_pause_breaks(self, result, break_gap=1.1):
        """用逐字時間戳的「停頓」插入換行：字間隔 >= break_gap 秒視為一次斷句，插入 \\n。
        連續講話約 0.1~0.2s，真正停頓 0.5~2.7s，分得很開。
        token 對齊不到（含英文 subword）時放棄斷行，回傳原文字。"""
        text = (getattr(result, "text", "") or "").strip()
        tokens = list(getattr(result, "tokens", []) or [])
        ts = list(getattr(result, "timestamps", []) or [])
        if not tokens or len(ts) != len(tokens) or len(tokens) < 2:
            return text
        out = [tokens[0]]
        for i in range(1, len(tokens)):
            if ts[i] - ts[i - 1] >= break_gap:
                out.append("\n")
            out.append(tokens[i])
        rebuilt = "".join(out)
        # 重建文字（去 \n）若與 result.text 差太多（多半是英文 subword 標記），放棄斷行
        if abs(len(rebuilt.replace("\n", "")) - len(text)) > max(3, int(len(text) * 0.15)):
            return text
        return rebuilt.strip()

    def _get_whisper_recognizer(self):
        """延遲載入 Whisper small（精準模式 / 重辨救援用）。首次呼叫才載入。"""
        if getattr(self, "whisper_recognizer", None) is not None:
            return self.whisper_recognizer
        import sherpa_onnx
        wdir = os.path.join(self._poc_sherpa_dir(), "sherpa-onnx-whisper-small")
        encoder = os.path.join(wdir, "small-encoder.int8.onnx")
        decoder = os.path.join(wdir, "small-decoder.int8.onnx")
        tokens = os.path.join(wdir, "small-tokens.txt")
        if not (os.path.exists(encoder) and os.path.exists(decoder) and os.path.exists(tokens)):
            raise RuntimeError("Whisper 模型未下載（poc-sherpa/sherpa-onnx-whisper-small）")
        logger.info("載入 Whisper small 模型（首次較慢）...")
        self.whisper_recognizer = sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=encoder,
            decoder=decoder,
            tokens=tokens,
            num_threads=self.num_threads,
            language="zh",
            task="transcribe",
        )
        logger.info("Whisper 模型載入完成")
        return self.whisper_recognizer

    def _vad_segment_list(self, samples):
        """用 VAD 把音訊切成多段語音（每段 ≤ max_speech_duration），
        回傳 list of np.float32 array；無 VAD / 失敗回 None。"""
        if self.vad is None:
            return None
        try:
            self.vad.reset()
            window_size = 512
            for i in range(0, len(samples), window_size):
                chunk = samples[i:i + window_size]
                if len(chunk) < window_size:
                    chunk = np.pad(chunk, (0, window_size - len(chunk)), 'constant')
                self.vad.accept_waveform(chunk)
            self.vad.flush()
            segs = []
            while not self.vad.empty():
                segs.append(np.array(self.vad.front.samples, dtype=np.float32))
                self.vad.pop()
            return segs if segs else None
        except Exception as e:
            logger.warning(f"VAD 分段失敗: {e}")
            return None

    def _init_punctuation_model(self):
        """在背景線程初始化 sherpa-onnx 標點模型（ct-transformer，免 torch）"""
        import threading

        def load_punc_model():
            try:
                import time
                import sherpa_onnx
                start_time = time.time()

                model_path = os.path.join(self.punct_model_dir, "model.onnx")
                if not os.path.exists(model_path):
                    logger.warning(
                        f"標點模型不存在，將使用規則式標點: {model_path}"
                    )
                    self.punc_model = None
                    return

                logger.info("正在載入 sherpa-onnx 標點模型 ct-transformer（背景）...")

                config = sherpa_onnx.OfflinePunctuationConfig(
                    model=sherpa_onnx.OfflinePunctuationModelConfig(
                        ct_transformer=model_path,
                        num_threads=self.num_threads,
                        provider="cpu",  # 標點模型小，CPU 已足夠快且最穩定
                    )
                )
                self.punc_model = sherpa_onnx.OfflinePunctuation(config)

                load_time = time.time() - start_time
                logger.info(f"sherpa-onnx 標點模型載入完成，耗時: {load_time:.2f} 秒")

            except Exception as e:
                logger.warning(f"標點模型載入失敗，將使用規則式標點: {e}")
                self.punc_model = None

        # 在背景線程載入，不阻塞主服務
        thread = threading.Thread(target=load_punc_model, daemon=True)
        thread.start()

    def _preprocess_audio(self, samples):
        """音頻預處理：正規化音量、降噪"""
        if len(samples) == 0:
            return samples

        # 1. 音量正規化 (Normalization)
        # 將音量調整到 -3dB（約 0.7 峰值），避免過小或過大
        max_val = np.max(np.abs(samples))
        if max_val > 0:
            target_peak = 0.7  # -3dB
            if max_val < 0.1:  # 音量太小，需要放大
                gain = target_peak / max_val
                # 限制最大增益，避免放大噪音（從 10x 降到 5x）
                gain = min(gain, 5.0)
                samples = samples * gain
                logger.debug(f"音量預處理: 放大 {gain:.1f}x (原始峰值: {max_val:.3f})")
            elif max_val > 0.95:  # 音量太大，可能削波
                samples = samples * (target_peak / max_val)
                logger.debug(f"音量預處理: 降低到 {target_peak:.1f} (原始峰值: {max_val:.3f})")

        # 2. 簡易降噪：移除低於閾值的微小信號（可能是底噪）
        # 從 0.01 降到 0.005，避免切掉輕聲子音和語尾
        noise_threshold = 0.005
        samples = np.where(np.abs(samples) < noise_threshold, 0, samples)

        return samples.astype(np.float32)

    def _add_punctuation(self, text):
        """使用 sherpa-onnx ct-transformer 標點模型或規則式添加標點"""
        if not text or not text.strip():
            return text

        text = text.strip()

        # 優先使用 sherpa-onnx 標點模型
        if self.punc_model is not None:
            try:
                punctuated = self.punc_model.add_punctuation(text)
                if punctuated:
                    logger.debug(f"標點結果: {punctuated}")
                    return punctuated
            except Exception as e:
                logger.warning(f"標點模型處理失敗，使用規則式: {e}")

        # 備用：規則式標點
        return add_punctuation(text)

    def initialize(self):
        """初始化 sherpa-onnx 識別器"""
        if self.initialized:
            return {"success": True, "message": "模型已初始化"}

        try:
            import time
            start_time = time.time()
            logger.info(f"正在初始化 sherpa-onnx，模型目錄: {self.model_dir}")

            # 檢查模型文件
            model_path = os.path.join(self.model_dir, "model.int8.onnx")
            tokens_path = os.path.join(self.model_dir, "tokens.txt")

            if not os.path.exists(model_path):
                return {
                    "success": False,
                    "error": f"模型文件不存在: {model_path}",
                    "type": "models_not_downloaded"
                }

            if not os.path.exists(tokens_path):
                return {
                    "success": False,
                    "error": f"詞表文件不存在: {tokens_path}",
                    "type": "models_not_downloaded"
                }

            import sherpa_onnx

            # 創建識別器（使用動態執行緒數 + 可選 GPU 加速）
            def _build_offline(provider):
                return sherpa_onnx.OfflineRecognizer.from_paraformer(
                    paraformer=model_path,
                    tokens=tokens_path,
                    num_threads=self.num_threads,
                    sample_rate=16000,
                    feature_dim=80,
                    decoding_method="greedy_search",
                    provider=provider,
                )

            try:
                self.recognizer = _build_offline(self.provider)
                logger.info(f"離線辨識器建立成功，provider={self.provider}")
            except Exception as e:
                if self.provider != "cpu":
                    logger.warning(f"provider={self.provider} 初始化失敗，回退至 CPU: {e}")
                    self.provider = "cpu"
                    self.recognizer = _build_offline("cpu")
                else:
                    raise

            # 初始化 Silero VAD
            self._init_vad()

            load_time = time.time() - start_time
            self.initialized = True
            logger.info(f"sherpa-onnx 初始化完成，耗時: {load_time:.2f} 秒，執行緒: {self.num_threads}")

            # 嘗試載入 FunASR 標點模型
            self._init_punctuation_model()

            return {
                "success": True,
                "message": f"sherpa-onnx 初始化成功，耗時: {load_time:.2f} 秒",
            }

        except ImportError as e:
            error_msg = "sherpa-onnx 未安裝，請執行: pip install sherpa-onnx"
            logger.error(error_msg)
            return {"success": False, "error": error_msg, "type": "import_error"}

        except Exception as e:
            error_msg = f"sherpa-onnx 初始化失敗: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            return {"success": False, "error": error_msg, "type": "init_error"}

    def initialize_streaming(self):
        """初始化串流辨識器 (Zipformer Transducer)"""
        if self.streaming_initialized:
            return {"success": True, "message": "串流模型已初始化"}

        try:
            import time
            start_time = time.time()
            logger.info(f"正在初始化串流辨識器，模型目錄: {self.streaming_model_dir}")

            # 檢查模型文件 - 暫時優先使用 fp32 模型（較準確）
            # TODO: 待品質問題解決後，可考慮恢復 int8 以提升速度
            encoder_fp32 = os.path.join(self.streaming_model_dir, "encoder-epoch-99-avg-1.onnx")
            decoder_fp32 = os.path.join(self.streaming_model_dir, "decoder-epoch-99-avg-1.onnx")
            joiner_fp32 = os.path.join(self.streaming_model_dir, "joiner-epoch-99-avg-1.onnx")

            encoder_int8 = os.path.join(self.streaming_model_dir, "encoder-epoch-99-avg-1.int8.onnx")
            decoder_int8 = os.path.join(self.streaming_model_dir, "decoder-epoch-99-avg-1.int8.onnx")
            joiner_int8 = os.path.join(self.streaming_model_dir, "joiner-epoch-99-avg-1.int8.onnx")

            # 優先使用 fp32 模型（品質更好），int8 作為後備
            use_fp32 = os.path.exists(encoder_fp32) and os.path.exists(decoder_fp32) and os.path.exists(joiner_fp32)

            if use_fp32:
                encoder_path = encoder_fp32
                decoder_path = decoder_fp32
                joiner_path = joiner_fp32
                logger.info("使用 fp32 模型（品質更佳）")
            elif os.path.exists(encoder_int8) and os.path.exists(decoder_int8) and os.path.exists(joiner_int8):
                encoder_path = encoder_int8
                decoder_path = decoder_int8
                joiner_path = joiner_int8
                logger.info("使用 int8 量化模型（fp32 不存在）")
            else:
                encoder_path = encoder_fp32
                decoder_path = decoder_fp32
                joiner_path = joiner_fp32
                logger.info("使用 fp32 模型")
            tokens_path = os.path.join(self.streaming_model_dir, "tokens.txt")
            bpe_vocab_path = os.path.join(self.streaming_model_dir, "bpe.vocab")

            for path, name in [(encoder_path, "encoder"), (decoder_path, "decoder"),
                               (joiner_path, "joiner"), (tokens_path, "tokens")]:
                if not os.path.exists(path):
                    return {
                        "success": False,
                        "error": f"串流模型文件不存在: {path}",
                        "type": "streaming_model_not_found"
                    }

            import sherpa_onnx

            # 準備熱詞參數
            hotwords_file = None
            hotwords_score = self.hotwords_score
            # 預設使用 modified_beam_search 提升精準度（比 greedy_search 更準）
            decoding_method = "modified_beam_search"

            # 檢查是否啟用熱詞功能
            if self.hotwords_enabled:
                # 取得所有熱詞（內建 + 使用者）
                all_words = self._get_all_hotwords()

                if all_words and len(all_words) > 0:
                    # 寫入臨時熱詞檔案供辨識器使用
                    hotwords_path = self._get_hotwords_path() + ".active"
                    try:
                        with open(hotwords_path, 'w', encoding='utf-8') as f:
                            for word in all_words:
                                f.write(f"{word}\n")
                        hotwords_file = hotwords_path
                        decoding_method = "modified_beam_search"
                        user_count = len(self._load_hotwords_file())
                        builtin_count = len(self._BUILTIN_HOTWORDS)
                        logger.info(f"啟用熱詞功能: {len(all_words)} 個詞 (內建:{builtin_count}, 使用者:{user_count}), score={hotwords_score}, decoding={decoding_method}")
                    except Exception as e:
                        logger.error(f"寫入熱詞檔案失敗: {e}")
                        logger.info("回退到 greedy_search")
                else:
                    logger.info("熱詞功能已啟用但無熱詞，使用 modified_beam_search")
            else:
                logger.info(f"熱詞功能已停用，使用 {decoding_method}")

            # 創建串流辨識器 (Transducer)
            recognizer_params = {
                "encoder": encoder_path,
                "decoder": decoder_path,
                "joiner": joiner_path,
                "tokens": tokens_path,
                "num_threads": self.num_threads,
                "provider": self.provider,
                "sample_rate": 16000,
                "feature_dim": 80,
                "decoding_method": decoding_method,
                # 快速 endpoint 檢測設定（速度優先）
                "enable_endpoint_detection": True,
                "rule1_min_trailing_silence": 1.0,   # 長靜音後結束
                "rule2_min_trailing_silence": 0.5,   # 短靜音後結束
                "rule3_min_utterance_length": 6,     # 最小句子長度
            }

            # 如果有熱詞，加入熱詞相關參數
            if hotwords_file and os.path.exists(hotwords_file):
                recognizer_params["hotwords_file"] = hotwords_file
                recognizer_params["hotwords_score"] = hotwords_score
                # 檢查 bpe.vocab 是否存在
                if os.path.exists(bpe_vocab_path):
                    recognizer_params["bpe_vocab"] = bpe_vocab_path
                    logger.info(f"使用 BPE 詞彙表: {bpe_vocab_path}")
                else:
                    logger.warning(f"BPE 詞彙表不存在: {bpe_vocab_path}，熱詞功能可能受限")

            try:
                self.streaming_recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(**recognizer_params)
                logger.info(f"串流辨識器建立成功，provider={recognizer_params.get('provider')}")
            except Exception as e:
                if recognizer_params.get("provider") != "cpu":
                    logger.warning(f"串流 provider={recognizer_params.get('provider')} 初始化失敗，回退至 CPU: {e}")
                    recognizer_params["provider"] = "cpu"
                    self.provider = "cpu"
                    self.streaming_recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(**recognizer_params)
                else:
                    raise

            # 記錄熱詞檔案路徑
            self.hotwords_file = hotwords_file

            load_time = time.time() - start_time
            self.streaming_initialized = True

            hotwords_status = f"熱詞: {'啟用' if hotwords_file else '停用'}"
            logger.info(f"串流辨識器初始化完成，耗時: {load_time:.2f} 秒, {hotwords_status}")

            return {
                "success": True,
                "message": f"串流辨識器初始化成功，耗時: {load_time:.2f} 秒",
                "hotwords_enabled": hotwords_file is not None,
                "decoding_method": decoding_method,
            }

        except Exception as e:
            error_msg = f"串流辨識器初始化失敗: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            return {"success": False, "error": error_msg, "type": "streaming_init_error"}

    def stream_init(self, session_id, options=None):
        """初始化串流會話"""
        # 確保串流辨識器已初始化
        if not self.streaming_initialized:
            init_result = self.initialize_streaming()
            if not init_result["success"]:
                return init_result

        try:
            # 創建新的串流
            stream = self.streaming_recognizer.create_stream()
            self.streaming_sessions[session_id] = {
                "stream": stream,
                "text_buffer": "",
                "sample_count": 0,
                "start_time": __import__('time').time(),
            }

            logger.info(f"串流會話已創建: {session_id}")
            return {
                "success": True,
                "session_id": session_id,
                "message": "串流會話已初始化"
            }

        except Exception as e:
            error_msg = f"創建串流會話失敗: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

    def _check_speech_energy(self, samples):
        """快速檢測音訊是否包含語音（基於能量）"""
        if len(samples) == 0:
            return False
        # 計算 RMS 能量
        rms = np.sqrt(np.mean(samples ** 2))
        return rms > self.streaming_vad_threshold

    def stream_feed(self, session_id, audio_data, is_final=False):
        """接收音頻數據並返回中間結果"""
        if session_id not in self.streaming_sessions:
            return {"success": False, "error": f"會話不存在: {session_id}"}

        try:
            import base64

            session = self.streaming_sessions[session_id]
            stream = session["stream"]

            # 解碼 Base64 音頻數據
            audio_bytes = base64.b64decode(audio_data)
            samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0

            # 音頻預處理：正規化音量、簡易降噪
            samples = self._preprocess_audio(samples)

            # 串流 VAD 檢測
            self.streaming_vad_total += 1
            is_speech = True  # 預設有語音

            if self.streaming_vad_enabled and not is_final:
                is_speech = self._check_speech_energy(samples)
                if not is_speech:
                    self.streaming_vad_skipped += 1
                    # 靜音，返回上次結果，不送辨識
                    last_text = session.get("last_partial_text", "")
                    return {
                        "success": True,
                        "session_id": session_id,
                        "partial_text": last_text,
                        "is_endpoint": False,
                        "is_final": False,
                        "is_speech": False,
                    }

            # 有語音或 is_final，餵入音頻數據
            stream.accept_waveform(16000, samples)
            session["sample_count"] += len(samples)

            # 解碼並獲取中間結果
            decode_count = 0
            while self.streaming_recognizer.is_ready(stream):
                self.streaming_recognizer.decode_stream(stream)
                decode_count += 1

            # 獲取當前結果
            result = self.streaming_recognizer.get_result(stream)

            # Debug: 看 result 的類型和內容
            logger.debug(f"[串流] decode_count={decode_count}, result type={type(result)}, result={repr(result)[:200]}")

            # 處理結果 - result 可能是字串或物件
            if isinstance(result, str):
                partial_text = result.strip()
            elif hasattr(result, 'text'):
                partial_text = result.text.strip() if result.text else ""
            else:
                partial_text = str(result).strip() if result else ""

            # Debug log 僅在有文字時記錄
            if partial_text:
                logger.info(f"[串流] 即時結果: {partial_text}")

            # 檢查是否檢測到端點（句子結束）
            is_endpoint = self.streaming_recognizer.is_endpoint(stream)
            if is_endpoint:
                # 累積到 buffer，對完成的句子加標點
                if partial_text:
                    punctuated = self._add_punctuation(partial_text)
                    session["text_buffer"] += punctuated
                    logger.info(f"[串流] 端點檢測，加標點: {punctuated}")
                # 重置 stream 以開始新句子
                self.streaming_recognizer.reset(stream)
                partial_text = ""

            # 返回累積的 buffer + 當前 partial
            current_text = (session["text_buffer"] + partial_text).strip()
            traditional_text = to_traditional(current_text)

            # 儲存給下次 VAD 跳過時使用
            session["last_partial_text"] = traditional_text

            return {
                "success": True,
                "session_id": session_id,
                "partial_text": traditional_text,
                "is_endpoint": is_endpoint,
                "is_final": is_final,
                "is_speech": True,
            }

        except Exception as e:
            error_msg = f"處理音頻數據失敗: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            return {"success": False, "error": error_msg}

    def stream_end(self, session_id):
        """結束串流會話並返回最終結果"""
        if session_id not in self.streaming_sessions:
            return {"success": False, "error": f"會話不存在: {session_id}"}

        try:
            import time

            session = self.streaming_sessions[session_id]
            stream = session["stream"]

            # 標記輸入結束
            stream.input_finished()

            # 最後一次解碼
            while self.streaming_recognizer.is_ready(stream):
                self.streaming_recognizer.decode_stream(stream)

            # 獲取最終結果（endpoint reset 後的剩餘文字）
            final_result = self.streaming_recognizer.get_result(stream)
            remaining_text = final_result.strip() if final_result else ""

            logger.info(f"[stream_end] text_buffer='{session['text_buffer'][:50] if session['text_buffer'] else '(空)'}', remaining='{remaining_text[:50] if remaining_text else '(空)'}'")

            # 組合最終文字
            if session["text_buffer"]:
                # 有 buffer（之前有觸發 endpoint）
                if remaining_text and remaining_text not in session["text_buffer"]:
                    # 還有剩餘文字，加標點後合併
                    remaining_with_punc = self._add_punctuation(remaining_text)
                    text_with_punc = (session["text_buffer"] + remaining_with_punc).strip()
                else:
                    # 沒有剩餘或已在 buffer 中
                    text_with_punc = session["text_buffer"].strip()
            elif remaining_text:
                # 沒有 buffer 但有剩餘文字（短句沒觸發 endpoint）
                text_with_punc = self._add_punctuation(remaining_text)
                logger.info(f"[stream_end] 使用 remaining_text 作為最終結果")
            else:
                # 完全沒有文字，嘗試使用 last_partial_text
                text_with_punc = session.get("last_partial_text", "").strip()
                if text_with_punc:
                    # 從繁體轉回簡體再加標點（last_partial_text 已經是繁體）
                    logger.info(f"[stream_end] 使用 last_partial_text 作為最終結果: {text_with_punc[:30]}")

            # 強制確保有句末標點（方案 A：提升標點覆蓋率）
            if text_with_punc and not text_with_punc.endswith(('。', '？', '！', '，', '；', '：')):
                # 再跑一次標點，確保有句末標點
                text_with_punc = self._add_punctuation(text_with_punc)
                # 如果還是沒有，強制加句號
                if not text_with_punc.endswith(('。', '？', '！', '，', '；', '：')):
                    text_with_punc += '。'
                logger.info(f"[stream_end] 強制加句末標點: {text_with_punc[-10:]}")

            # 保存原始文字（用於 debug）
            raw_text = text_with_punc

            # 計算時長
            duration = session["sample_count"] / 16000.0
            elapsed = time.time() - session["start_time"]

            # 清理會話
            del self.streaming_sessions[session_id]

            logger.info(f"串流會話結束: {session_id}, 結果: {text_with_punc[:50] if text_with_punc else '(空)'}...")

            return {
                "success": True,
                "session_id": session_id,
                "final_text": to_traditional(format_lists(apply_punct_rules(clean_transcript(text_with_punc)))),
                "raw_text": to_traditional(raw_text),
                "duration": round(duration, 2),
                "process_time": round(elapsed, 2),
            }

        except Exception as e:
            error_msg = f"結束串流會話失敗: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            # 嘗試清理會話
            if session_id in self.streaming_sessions:
                del self.streaming_sessions[session_id]
            return {"success": False, "error": error_msg}

    def _read_wave_file(self, wav_path):
        """讀取 WAV 檔案"""
        with wave.open(wav_path, 'rb') as wf:
            sample_rate = wf.getframerate()
            num_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            num_frames = wf.getnframes()

            data = wf.readframes(num_frames)

            if sample_width == 2:
                samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            else:
                samples = np.frombuffer(data, dtype=np.int8).astype(np.float32) / 128.0

            if num_channels == 2:
                samples = samples.reshape(-1, 2).mean(axis=1)

            return samples, sample_rate

    def transcribe_audio(self, audio_path, options=None):
        """轉錄音頻文件"""
        if not self.initialized:
            init_result = self.initialize()
            if not init_result["success"]:
                return init_result

        try:
            import time

            if not os.path.exists(audio_path):
                return {"success": False, "error": f"音頻文件不存在: {audio_path}"}

            # 模型選擇：預設 Paraformer（快）；options.model=='whisper' 走精準模式
            options = options or {}
            use_whisper = options.get("model") == "whisper"
            recognizer = self.recognizer
            if use_whisper:
                try:
                    recognizer = self._get_whisper_recognizer()
                    logger.info("使用 Whisper small 精準模式辨識")
                except Exception as e:
                    logger.warning(f"Whisper 不可用，改用 Paraformer: {e}")
                    use_whisper = False
                    recognizer = self.recognizer

            logger.info(f"開始轉錄音頻文件: {audio_path}")
            start_time = time.time()

            # 讀取音頻
            samples, sample_rate = self._read_wave_file(audio_path)
            duration = len(samples) / sample_rate

            # 只做音量正規化，不做降噪和 VAD（平衡速度和準確度）
            max_val = np.max(np.abs(samples))
            if max_val > 0 and max_val < 0.1:
                gain = min(0.7 / max_val, 5.0)
                samples = samples * gain
            speech_samples = samples
            skipped_duration = 0.0

            # 長音訊（>15s）：用 VAD 切成多段、每段各自辨識再拼接。
            # Paraformer 是為短句設計的，整段塞太長會幻聽/吃字；分段可根治。
            # 短音訊維持原本單次解碼（零回歸）。
            LONG_AUDIO_SEC = 15.0
            segments = self._vad_segment_list(speech_samples) if duration > LONG_AUDIO_SEC else None

            if segments and len(segments) > 1:
                logger.info(f"長音訊分段辨識：{duration:.1f}s -> {len(segments)} 段")
                raw_parts = [self._transcribe_samples(seg, sample_rate, recognizer) for seg in segments]
                text = "".join(p for p in raw_parts if p)
            else:
                # 單次解碼：用逐字時間戳在「停頓」處斷行（韻律斷句，免 AI）
                stream = recognizer.create_stream()
                stream.accept_waveform(sample_rate, speech_samples)
                recognizer.decode_stream(stream)
                if recognizer is self.recognizer:  # 只有 Paraformer 有時間戳
                    text = self._apply_pause_breaks(stream.result)
                else:
                    text = (stream.result.text or "").strip()

            # 文字清理：全形英文→半形 + 去口吃重複（保留正常疊字、保留換行）
            text = clean_transcript(text)

            elapsed = time.time() - start_time
            rtf = elapsed / duration

            self.transcription_count += 1
            self.total_audio_duration += duration

            # 逐行加標點（ct-punc 模型）+ 句末語助詞規則。
            # 逐行處理是為了不把換行 \n 餵進標點模型導致出錯。
            punct_lines = []
            for ln in text.split("\n"):
                if ln.strip():
                    p = self._add_punctuation(ln)
                    p = apply_punct_rules(p)
                    punct_lines.append(p)
                else:
                    punct_lines.append(ln)
            text_with_punc = "\n".join(punct_lines)
            # 規則式列點排版（免 AI）：第一/第二/第三… → 1. 2. 3. 換行清單
            text_with_punc = format_lists(text_with_punc)

            logger.info(f"轉錄完成: {text_with_punc[:100]}... (RTF: {rtf:.3f})")

            return {
                "success": True,
                "text": to_traditional(text_with_punc),
                "raw_text": to_traditional(text),  # 保留原始無標點文本
                "confidence": 0.95,  # sherpa-onnx 不提供置信度，給個默認值
                "duration": duration,
                "language": "zh-TW",
                "model_type": "sherpa-onnx",
                "rtf": rtf,
                "process_time": elapsed,
                "vad_skipped": skipped_duration,  # VAD 跳過的靜音時長
            }

        except Exception as e:
            error_msg = f"音頻轉錄失敗: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            return {"success": False, "error": error_msg, "type": "transcription_error"}

    def check_status(self):
        """檢查狀態"""
        try:
            import sherpa_onnx
            return {
                "success": True,
                "installed": True,
                "initialized": self.initialized,
                "streaming_initialized": self.streaming_initialized,
                "version": sherpa_onnx.__version__,
                "model_dir": self.model_dir,
                "streaming_model_dir": self.streaming_model_dir,
                "num_threads": self.num_threads,
                "models": {
                    "asr": self.recognizer is not None,
                    "streaming_asr": self.streaming_recognizer is not None,
                    "vad": self.vad is not None,  # Silero VAD 狀態
                    "punc": self.punc_model is not None,  # ct-punc 狀態
                },
                "active_streaming_sessions": len(self.streaming_sessions),
            }
        except ImportError:
            return {
                "success": False,
                "installed": False,
                "initialized": False,
                "streaming_initialized": False,
                "error": "sherpa-onnx 未安裝",
            }

    def get_performance_stats(self):
        """獲取性能統計"""
        return {
            "transcription_count": self.transcription_count,
            "total_audio_duration": round(self.total_audio_duration, 2),
            "average_duration": round(
                self.total_audio_duration / max(1, self.transcription_count), 2
            ),
            "vad_skipped_duration": round(self.vad_skipped_duration, 2),
            "vad_efficiency": round(
                self.vad_skipped_duration / max(0.01, self.total_audio_duration) * 100, 1
            ) if self.total_audio_duration > 0 else 0,
            "initialized": self.initialized,
            "engine": "sherpa-onnx",
            "num_threads": self.num_threads,
            "vad_enabled": self.vad is not None,
            # 串流 VAD 統計
            "streaming_vad_enabled": self.streaming_vad_enabled,
            "streaming_vad_total": self.streaming_vad_total,
            "streaming_vad_skipped": self.streaming_vad_skipped,
            "streaming_vad_efficiency": round(
                self.streaming_vad_skipped / max(1, self.streaming_vad_total) * 100, 1
            ),
        }

    # ========== 熱詞管理方法 ==========

    # 內建熱詞（不顯示給使用者，但會用於辨識）
    # 注意：模型使用簡體中文詞彙表，熱詞必須用簡體+空格分隔
    _BUILTIN_HOTWORDS = [
        # 產品相關
        "声 声 慢",        # 聲聲慢
        "语 音 转 录",     # 語音轉錄
        "转 录",           # 轉錄
        # 前端技術
        "异 步",           # 非同步
        "同 步",           # 同步
        "缓 存",           # 快取
        "优 化",           # 優化
        "渲 染",           # 渲染
        "组 件",           # 組件
        "框 架",           # 框架
        "状 态",           # 狀態
        "响 应 式",        # 響應式
        "面 包 屑",        # 麵包屑
        "导 航 栏",        # 導航欄
        "路 由",           # 路由
        "钩 子",           # 鉤子 (hooks)
        "插 件",           # 插件
        # 後端技術
        "接 口",           # 接口 (API)
        "函 数",           # 函數
        "回 调",           # 回調 (callback)
        "线 程",           # 線程
        "进 程",           # 進程
        "容 器",           # 容器
        "部 署",           # 部署
        "编 译",           # 編譯
        "调 试",           # 調試
        # 通用開發
        "依 赖",           # 依賴
        "模 块",           # 模組
        "配 置",           # 配置
        "环 境 变 量",     # 環境變數
        "异 常",           # 異常
        "错 误",           # 錯誤
        "日 志",           # 日誌
        "策 略",           # 策略
    ]

    def _get_hotwords_path(self):
        """取得熱詞檔案路徑"""
        user_data_dir = os.environ.get("ELECTRON_USER_DATA", ".")
        return os.path.join(user_data_dir, "hotwords.txt")

    def _load_hotwords_file(self):
        """從檔案載入熱詞"""
        hotwords_path = self._get_hotwords_path()
        words = []

        if os.path.exists(hotwords_path):
            try:
                with open(hotwords_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        # 跳過空行和註解
                        if line and not line.startswith('#'):
                            words.append(line)
                logger.info(f"載入 {len(words)} 個熱詞從 {hotwords_path}")
            except Exception as e:
                logger.error(f"載入熱詞檔案失敗: {e}")
        else:
            logger.info(f"熱詞檔案不存在: {hotwords_path}，將使用空列表")

        return words

    def _get_all_hotwords(self):
        """取得所有熱詞（包含內建 + 使用者自訂）"""
        user_words = self._load_hotwords_file()
        # 合併內建熱詞，避免重複
        all_words = list(self._BUILTIN_HOTWORDS)
        for word in user_words:
            if word not in all_words:
                all_words.append(word)
        return all_words

    def _save_hotwords_file(self, words):
        """儲存熱詞到檔案"""
        hotwords_path = self._get_hotwords_path()

        try:
            # 確保目錄存在
            os.makedirs(os.path.dirname(hotwords_path) or '.', exist_ok=True)

            with open(hotwords_path, 'w', encoding='utf-8') as f:
                f.write("# 熱詞列表 - 每行一個詞彙\n")
                for word in words:
                    if word.strip():
                        f.write(f"{word.strip()}\n")

            logger.info(f"儲存 {len(words)} 個熱詞到 {hotwords_path}")
            return True
        except Exception as e:
            logger.error(f"儲存熱詞檔案失敗: {e}")
            return False

    def get_hotwords(self):
        """取得熱詞設定"""
        words = self._load_hotwords_file()
        return {
            "success": True,
            "enabled": self.hotwords_enabled,
            "score": self.hotwords_score,
            "words": words,
        }

    def set_hotwords(self, config):
        """設定熱詞 (enabled, score, words)"""
        try:
            changed = False

            # 更新 enabled
            if "enabled" in config:
                new_enabled = bool(config["enabled"])
                if self.hotwords_enabled != new_enabled:
                    self.hotwords_enabled = new_enabled
                    changed = True
                    logger.info(f"熱詞功能: {'啟用' if new_enabled else '停用'}")

            # 更新 score
            if "score" in config:
                new_score = float(config["score"])
                # 限制分數範圍 1.0 - 3.0
                new_score = max(1.0, min(3.0, new_score))
                if self.hotwords_score != new_score:
                    self.hotwords_score = new_score
                    changed = True
                    logger.info(f"熱詞分數: {new_score}")

            # 更新 words
            if "words" in config:
                words = config["words"]
                if isinstance(words, list):
                    self._save_hotwords_file(words)
                    changed = True
                    logger.info(f"更新熱詞列表: {len(words)} 個詞")

            # 如果有變更且串流辨識器已初始化，需要重新初始化
            if changed and self.streaming_initialized:
                logger.info("熱詞設定變更，重新初始化串流辨識器...")
                self.streaming_initialized = False
                self.streaming_recognizer = None
                # 清除所有進行中的串流會話
                if self.streaming_sessions:
                    logger.warning(f"清除 {len(self.streaming_sessions)} 個進行中的串流會話")
                    self.streaming_sessions.clear()
                # 重新初始化
                init_result = self.initialize_streaming()
                if not init_result["success"]:
                    return {
                        "success": False,
                        "error": f"重新初始化串流辨識器失敗: {init_result.get('error', '未知錯誤')}",
                    }

            return {
                "success": True,
                "enabled": self.hotwords_enabled,
                "score": self.hotwords_score,
                "words": self._load_hotwords_file(),
            }

        except Exception as e:
            error_msg = f"設定熱詞失敗: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            return {"success": False, "error": error_msg}

    # ================================

    def run(self):
        """運行服務器主循環"""
        logger.info("Sherpa-ONNX 服務器啟動")

        # 初始化
        init_result = self.initialize()
        print(json.dumps(init_result, ensure_ascii=False))
        sys.stdout.flush()

        while self.running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break

                line = line.strip()
                if not line:
                    continue

                try:
                    command = json.loads(line)
                except json.JSONDecodeError:
                    result = {"success": False, "error": "無效的 JSON 命令"}
                    print(json.dumps(result, ensure_ascii=False))
                    sys.stdout.flush()
                    continue

                # 處理命令
                action = command.get("action")

                if action == "transcribe":
                    audio_path = command.get("audio_path")
                    options = command.get("options", {})
                    result = self.transcribe_audio(audio_path, options)
                elif action == "status":
                    result = self.check_status()
                elif action == "stats":
                    result = {"success": True, "stats": self.get_performance_stats()}
                # ========== 串流辨識命令 ==========
                elif action == "stream_init":
                    session_id = command.get("session_id")
                    options = command.get("options", {})
                    result = self.stream_init(session_id, options)
                elif action == "stream_feed":
                    session_id = command.get("session_id")
                    audio_data = command.get("audio_data")
                    is_final = command.get("is_final", False)
                    result = self.stream_feed(session_id, audio_data, is_final)
                elif action == "stream_end":
                    session_id = command.get("session_id")
                    result = self.stream_end(session_id)
                elif action == "init_streaming":
                    result = self.initialize_streaming()
                # ========== 熱詞命令 ==========
                elif action == "get_hotwords":
                    result = self.get_hotwords()
                elif action == "set_hotwords":
                    config = command.get("config", {})
                    result = self.set_hotwords(config)
                # ================================
                elif action == "exit":
                    result = {"success": True, "message": "服務器退出"}
                    print(json.dumps(result, ensure_ascii=False))
                    sys.stdout.flush()
                    break
                else:
                    result = {"success": False, "error": f"未知命令: {action}"}

                print(json.dumps(result, ensure_ascii=False))
                sys.stdout.flush()

            except KeyboardInterrupt:
                break
            except Exception as e:
                error_result = {
                    "success": False,
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                }
                print(json.dumps(error_result, ensure_ascii=False))
                sys.stdout.flush()

        logger.info("Sherpa-ONNX 服務器退出")


if __name__ == "__main__":
    # 強制 stdout/stderr 用 UTF-8。打包成 exe 後預設會跟系統碼頁(Big5)，
    # 中文的尾位元組可能含 \ 或 } 而破壞 JSON，導致主程序收到的初始化回應解析失敗。
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=str, default=None,
                        help="sherpa-onnx 模型目錄")
    args = parser.parse_args()

    server = SherpaServer(model_dir=args.model_dir)
    server.run()
