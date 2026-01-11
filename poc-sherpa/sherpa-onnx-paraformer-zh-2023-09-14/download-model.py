#!/usr/bin/env python3

# Please first run
# pip install modelscope

# See https://www.modelscope.cn/models/damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-onnx/file/view/master/quickstart.md


from modelscope.hub.file_download import model_file_download

files = [
    "model_quant.onnx",
    "am.mvn",
    "config.yaml",
    "configuration.json",
]
for f in files:
    model_dir = model_file_download(
        model_id="damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-onnx",
        file_path=f,
        revision="v1.2.4",
    )
    print(model_dir)

# /Users/fangjun/.cache/modelscope/hub/damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-onnx/model_quant.onnx
#
# mv model_quant.onnx model.int8.onnx
