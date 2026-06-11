# Introduction

This model is converted from
https://modelscope.cn/models/iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch/summary

The commands to generate the onnx model are given below:

```
pip install funasr modelscope
pip install kaldi-native-fbank torchaudio onnx onnxruntime

mkdir -p /tmp/models
cd /tmp/models

git clone https://www.modelscope.cn/iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch.git
cd punc_ct-transformer_zh-cn-common-vocab272727-pytorch
git lfs pull --include model.pt

cd /tmp
git clone https://github.com/alibaba-damo-academy/FunASR
cd FunASR/runtime/python/onnxruntime

cat >export-onnx.py <<EOF

from funasr_onnx import CT_Transformer
model_dir = "/tmp/punc_ct-transformer_zh-cn-common-vocab272727-pytorch" # model = CT_Transformer(model_dir, quantize=True) model = CT_Transformer(model_dir)
EOF

chmod +x export-onnx.py

./export-onnx.py
```

You will find the exported
`model.onnx` file inside
`/tmp/models/punc_ct-transformer_zh-cn-common-vocab272727-pytorch`.

Now you can use ./add-model-metadata.py in this repo to add metadata to the generated
`model.onnx`.

You can use
```
from onnxruntime.quantization import QuantType, quantize_dynamic

quantize_dynamic(
  model_input="./model.onnx",
  model_output="./model.int8.onnx",
  weight_type=QuantType.QUInt8,
)
```
to get the `int8` quantized model

```
-rw-r--r--  1 fangjun  staff    72M Jun 18 10:33 model.int8.onnx
-rw-r--r--  1 fangjun  staff   281M Apr 12  2024 model.onnx
```
