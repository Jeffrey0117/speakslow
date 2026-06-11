#!/usr/bin/env python3

# Copyright (c)  2023  Xiaomi Corporation
# Author: Fangjun Kuang

import json
from typing import Dict

import numpy as np
import onnx
import yaml


def add_meta_data(filename: str, meta_data: Dict[str, str]):
    """Add meta data to an ONNX model. It is changed in-place.

    Args:
      filename:
        Filename of the ONNX model to be changed.
      meta_data:
        Key-value pairs.
    """
    model = onnx.load(filename)
    while len(model.metadata_props):
        model.metadata_props.pop()

    for key, value in meta_data.items():
        meta = model.metadata_props.add()
        meta.key = key
        meta.value = str(value)

    onnx.save(model, filename)
    print(f"Updated {filename}")


def main():
    with open("config.yaml", "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    with open("tokens.json", "r", encoding="utf-8") as f:
        tokens = json.load(f)
    vocab_size = len(tokens)

    unk_symbol = config["tokenizer_conf"]["unk_symbol"]

    tokens = "|".join(tokens)

    punct_list = config["model_conf"]["punc_list"]
    punctuations = "|".join(punct_list)

    meta_data = {
        "tokens": tokens,
        "punctuations": punctuations,
        "model_type": "ct_transformer",
        "version": "1",
        "model_author": "damo",
        "vocab_size": vocab_size,
        "unk_symbol": unk_symbol,
        "comment": "iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch",
        "url": "https://modelscope.cn/models/iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch/summary",
    }
    add_meta_data("model.onnx", meta_data)


if __name__ == "__main__":
    main()
