#!/usr/bin/env python3

# Copyright (c)  2023  Xiaomi Corporation
# Author: Fangjun Kuang

import kaldi_native_fbank as knf
import librosa
import numpy as np
import onnxruntime


"""
---------inputs----------
speech ['batch_size', 'feats_length', 560] tensor(float)
speech_lengths ['batch_size'] tensor(int32)
---------outputs----------
logits ['batch_size', 'logits_length', 8404] tensor(float)
token_num ['Casttoken_num_dim_0'] tensor(int32)
us_alphas ['batch_size', 'alphas_length'] tensor(float)
us_cif_peak ['batch_size', 'alphas_length'] tensor(float)
"""


def show_model_info():
    session_opts = onnxruntime.SessionOptions()
    session_opts.log_severity_level = 3  # error level
    sess = onnxruntime.InferenceSession("model.int8.onnx", session_opts)
    print("---------inputs----------")
    for n in sess.get_inputs():
        print(n.name, n.shape, n.type)

    print("---------outputs----------")
    for n in sess.get_outputs():
        print(n.name, n.shape, n.type)

    import sys

    sys.exit(0)


def load_cmvn():
    neg_mean = None
    inv_std = None

    with open("am.mvn") as f:
        for line in f:
            if not line.startswith("<LearnRateCoef>"):
                continue
            t = line.split()[3:-1]
            t = list(map(lambda x: float(x), t))

            if neg_mean is None:
                neg_mean = np.array(t, dtype=np.float32)
            else:
                inv_std = np.array(t, dtype=np.float32)

    return neg_mean, inv_std


def compute_feat(filename):
    sample_rate = 16000
    samples, _ = librosa.load(filename, sr=sample_rate)
    opts = knf.FbankOptions()
    opts.frame_opts.dither = 0
    opts.frame_opts.snip_edges = False
    opts.frame_opts.samp_freq = sample_rate
    opts.mel_opts.num_bins = 80

    online_fbank = knf.OnlineFbank(opts)
    online_fbank.accept_waveform(sample_rate, (samples * 32768).tolist())
    online_fbank.input_finished()

    features = np.stack(
        [online_fbank.get_frame(i) for i in range(online_fbank.num_frames_ready)]
    )
    assert features.data.contiguous is True
    assert features.dtype == np.float32, features.dtype
    print("features sum", features.sum(), features.size)

    window_size = 7  # lfr_m
    window_shift = 6  # lfr_n

    T = (features.shape[0] - window_size) // window_shift + 1
    features = np.lib.stride_tricks.as_strided(
        features,
        shape=(T, features.shape[1] * window_size),
        strides=((window_shift * features.shape[1]) * 4, 4),
    )
    neg_mean, inv_std = load_cmvn()
    features = (features + neg_mean) * inv_std
    return features


# tokens.txt in paraformer has only one column
# while it has two columns ins sherpa-onnx.
# This function can handle tokens.txt from both paraformer and sherpa-onnx
def load_tokens():
    ans = dict()
    i = 0
    with open("tokens.txt", encoding="utf-8") as f:
        for line in f:
            ans[i] = line.strip().split()[0]
            i += 1
    return ans


def main():
    #  show_model_info()
    features = compute_feat("1.wav")
    features = np.expand_dims(features, axis=0)
    print(np.sum(features), features.size, features.shape)
    features_length = np.array([features.shape[1]], dtype=np.int32)

    features2 = compute_feat("2.wav")
    print(np.sum(features2), features2.size, features2.shape)
    features2 = np.expand_dims(features2, axis=0)
    features2_length = np.array([features2.shape[1]], dtype=np.int32)
    print(features.shape, features2.shape)

    pad = np.ones((1, 10, 560), dtype=np.float32) * -23.0258
    features3 = np.concatenate([features2, pad], axis=1)

    features4 = np.concatenate([features, features3], axis=0)
    features4_length = np.array([features.shape[1], features2.shape[1]], dtype=np.int32)
    print(features4.shape, features4_length)

    session_opts = onnxruntime.SessionOptions()
    session_opts.log_severity_level = 3  # error level
    sess = onnxruntime.InferenceSession("model.int8.onnx", session_opts)

    inputs = {
        "speech": features4,
        "speech_lengths": features4_length,
    }
    output_names = ["logits", "token_num", "us_alphas", "us_cif_peak"]

    try:
        outputs = sess.run(output_names, input_feed=inputs)
    except ONNXRuntimeError:
        print("Input wav is silence or noise")
        return

    print("0", outputs[0].shape)
    print("1", outputs[1].shape)
    print("2", outputs[2].shape)
    print("3", outputs[3].shape)
    log_probs = outputs[0][0]
    log_probs1 = outputs[0][1]
    y = log_probs.argmax(axis=-1)[: outputs[1][0]]
    y1 = log_probs1.argmax(axis=-1)[: outputs[1][1]]
    print(outputs[1])
    print(y)
    print(y1)

    tokens = load_tokens()
    text = "".join([tokens[i] for i in y if i not in (0, 2)])
    print(text)

    text1 = "".join([tokens[i] for i in y1 if i not in (0, 2)])
    print(text1)

    token_num = outputs[1]

    print([i for i in outputs[-1][0] if i > (1 - 1e-4)])
    print(len([i for i in outputs[-1][0] if i > (1 - 1e-4)]))
    print(token_num[0])

    print([i for i in outputs[-1][1] if i > (1 - 1e-4)])
    print(len([i for i in outputs[-1][1] if i > (1 - 1e-4)]))
    print(token_num[1])


if __name__ == "__main__":
    main()
