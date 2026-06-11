#!/usr/bin/env python3
# Copyright (c)  2024  Xiaomi Corporation
# Author: Fangjun Kuang

import onnxruntime
import numpy as np


class OnnxModel:
    def __init__(self):
        session_opts = onnxruntime.SessionOptions()
        session_opts.log_severity_level = 3  # error level
        self.sess = onnxruntime.InferenceSession("model.onnx", session_opts)

        self._init_punct()
        self._init_tokens()

    def _init_punct(self):
        meta = self.sess.get_modelmeta().custom_metadata_map
        punct = meta["punctuations"].split("|")
        self.id2punct = punct
        self.punct2id = {p: i for i, p in enumerate(punct)}

        self.dot = self.punct2id["。"]
        self.comma = self.punct2id["，"]
        self.pause = self.punct2id["、"]
        self.quest = self.punct2id["？"]
        self.underscore = self.punct2id["_"]

    def _init_tokens(self):
        meta = self.sess.get_modelmeta().custom_metadata_map
        tokens = meta["tokens"].split("|")
        self.id2token = tokens
        self.token2id = {t: i for i, t in enumerate(tokens)}

        unk = meta["unk_symbol"]
        assert unk in self.token2id, unk

        self.unk_id = self.token2id[unk]

    def __call__(self, text: str) -> str:
        word_list = text.split()

        words = []
        for w in word_list:
            s = ""
            for c in w:
                if len(c.encode()) > 1:
                    if s == "":
                        s = c
                    elif len(s[-1].encode()) > 1:
                        s += c
                    else:
                        words.append(s)
                        s = c
                else:
                    if s == "":
                        s = c
                    elif len(s[-1].encode()) > 1:
                        words.append(s)
                        s = c
                    else:
                        s += c
            if s:
                words.append(s)

        print(text)
        print(words)
        ids = []
        for w in words:
            if len(w[0].encode()) > 1:
                # a Chinese phrase:
                for c in w:
                    ids.append(self.token2id.get(c, self.unk_id))
            else:
                ids.append(self.token2id.get(w, self.unk_id))
        print(text)
        print(words)
        print(ids)

        segment_size = 20
        num_segments = (len(ids) + segment_size - 1) // segment_size

        punctuations = []

        max_len = 200

        last = -1
        for i in range(num_segments):
            this_start = i * segment_size
            this_end = min(this_start + segment_size, len(ids))
            if last != -1:
                this_start = last

            inputs = ids[this_start:this_end]

            out = self.sess.run(
                [
                    self.sess.get_outputs()[0].name,
                ],
                {
                    self.sess.get_inputs()[0]
                    .name: np.array(inputs, dtype=np.int32)
                    .reshape(1, -1),
                    self.sess.get_inputs()[1].name: np.array(
                        [len(inputs)], dtype=np.int32
                    ),
                },
            )[0]
            out = out[0]  # remove the batch dim
            out = out.argmax(axis=-1).tolist()

            dot_index = -1
            comma_index = -1

            for k in range(len(out) - 1, 1, -1):
                if out[k] in (self.dot, self.quest):
                    dot_index = k
                    break
                if comma_index == -1 and out[k] == self.comma:
                    comma_index = k
            if dot_index == -1 and len(inputs) >= max_len and comma_index != -1:
                dot_index = comma_index
                out[dot_index] = self.dot

            if dot_index == -1:
                if last == -1:
                    last = this_start

                if i == num_segments - 1:
                    dot_index = len(inputs) - 1
            else:
                last = this_start + dot_index + 1

            if dot_index != -1:
                punctuations += out[: dot_index + 1]

        print(len(ids), len(punctuations))

        ans = []

        for i, p in enumerate(punctuations):
            t = self.id2token[ids[i]]
            if ans and len(ans[-1][0].encode()) == 1 and len(t[0].encode()) == 1:
                ans.append(" ")
            ans.append(t)
            if p != self.underscore:
                ans.append(self.id2punct[p])

        return "".join(ans)


def main():
    text = "你好吗how are you我很好谢谢"
    model = OnnxModel()
    result = model(text)
    print(result)


if __name__ == "__main__":
    main()
