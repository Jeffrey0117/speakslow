#!/usr/bin/env python3

import onnxruntime

"""
## model.onnx
NodeArg(name='inputs', type='tensor(int32)', shape=['batch_size', 'feats_length'])
NodeArg(name='text_lengths', type='tensor(int32)', shape=['batch_size'])
----------
NodeArg(name='logits', type='tensor(float)', shape=['batch_size', 'logits_length', 6])
"""


def display(sess):
    for i in sess.get_inputs():
        print(i)

    print("----------")
    for o in sess.get_outputs():
        print(o)


def test_model():
    session_opts = onnxruntime.SessionOptions()
    session_opts.log_severity_level = 3  # error level
    sess = onnxruntime.InferenceSession("model.onnx", session_opts)
    display(sess)


def main():
    test_model()


if __name__ == "__main__":
    main()
