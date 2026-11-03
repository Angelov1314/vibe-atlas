# Local Model Arena — research notes

Research date: 2026-11-02. Dataset: 40 models and 34 modality tags. This is a verified starting candidate set, not an assertion of global popularity or quality leadership.

## Evidence and cold start

- Main evidence comes from the model authors’ GitHub repositories, model cards on Hugging Face, and version-specific license files. Search engine results were verified against the publisher URLs where license/version ambiguity mattered.
- GitHub stars are a timestamped project adoption signal. They are not model quality, Arena votes, or a proxy for actual hardware performance.
- No X firehose, API mention counts, or representative X sampling was available in this research. X popularity must remain unavailable until an authorized collector supplies measured data.
- Every Arena score is null and every effective vote count begins at zero. No generated sample, timing, VRAM benchmark, or community opinion has been invented.
- Model version, precision, sampling settings, resolution, duration, and hardware must be pinned for comparisons. Family-level repository counts must not be repeated as independent evidence for multiple variants.
- “Permissive open weights” means the listed checkpoint has a permissive license; it is not a certification of the OSI Open Source AI definition. Code licenses, model licenses, dependencies, and datasets are separate layers.
- Card images are GitHub repository previews, explicitly labeled as such. They are not examples of outputs produced by this Arena.

## Changes that matter

1. YuE’s current repository fronts YuE2. Its code is Apache-2.0; its weights use CC-BY-NC-4.0 with additional creator permission. Do not inherit the earlier release’s license assumptions.
2. LTX-2 has separate license files for older 2.0–2.3 releases and 2.5-onward. Treat the exact checkpoint and license revision as part of the model identity.
3. CogVideoX-2B is Apache-2.0, but the 5B models use another model license. The candidate record here explicitly selects the 2B version.
4. Depth Anything V2 Small is Apache-2.0; Base/Large/Giant are CC-BY-NC-4.0. A model-size filter must not silently change the license.
5. F5-TTS is MIT code plus non-commercial pretrained weights. LivePortrait’s main MIT license does not remove the non-commercial restriction on its default InsightFace model dependency.
6. SenseVoice’s official code is MIT but its weights follow the FunASR model license. A repository license icon is insufficient for commercial filtering.
7. Current canonical repositories include QwenAudio/CosyVoice, QwenAudio/SenseVoice, KlingAIResearch/LivePortrait, and zai-org/CogVideo. Old owner URLs may redirect.
8. Qwen-Image’s repository announces newer products; this catalog selects the verified published 2512 / Edit-2511 weight cards and does not assume every announcement is downloadable.

## Per-model evidence

| Model | Scope | License evidence | Deployment / repository |
|---|---|---|---|
| Qwen-Image | permissive-open-weights | [Apache-2.0](https://github.com/QwenLM/Qwen-Image#license-agreement) | [Official repository](https://github.com/QwenLM/Qwen-Image) |
| Qwen-Image-Edit | permissive-open-weights | [Apache-2.0](https://github.com/QwenLM/Qwen-Image) | [Official repository](https://github.com/QwenLM/Qwen-Image) |
| FLUX.1 schnell | permissive-open-weights | [Apache-2.0](https://github.com/black-forest-labs/flux/blob/main/model_cards/FLUX.1-schnell.md) | [Official repository](https://github.com/black-forest-labs/flux) |
| FLUX.1 dev | restricted-open-weights | [FLUX.1-dev Non-Commercial License](https://github.com/black-forest-labs/flux/blob/main/model_licenses/LICENSE-FLUX1-dev) | [Official repository](https://github.com/black-forest-labs/flux) |
| Stable Diffusion XL | restricted-open-weights | [CreativeML Open RAIL++-M](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) | [Official repository](https://github.com/Stability-AI/generative-models) |
| SANA | permissive-open-weights | [Apache-2.0](https://huggingface.co/Efficient-Large-Model/Sana_1600M_1024px_BF16) | [Official repository](https://github.com/NVlabs/Sana) |
| Wan2.2 | permissive-open-weights | [Apache-2.0](https://github.com/Wan-Video/Wan2.2) | [Official repository](https://github.com/Wan-Video/Wan2.2) |
| LTX-2 / 2.x | restricted-open-weights | [LTX Community License (checkpoint-specific)](https://github.com/Lightricks/LTX-2/blob/main/LICENSE) | [Official repository](https://github.com/Lightricks/LTX-2) |
| HunyuanVideo-1.5 | restricted-open-weights | [Tencent Hunyuan Community License](https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5) | [Official repository](https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5) |
| CogVideoX-2B | permissive-open-weights | [Apache-2.0 (2B only)](https://github.com/zai-org/CogVideo#model-license) | [Official repository](https://github.com/zai-org/CogVideo) |
| Mochi 1 | permissive-open-weights | [Apache-2.0](https://github.com/genmoai/mochi) | [Official repository](https://github.com/genmoai/mochi) |
| Hunyuan3D-2 | restricted-open-weights | [Tencent Hunyuan 3D 2.0 Community License](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/main/LICENSE) | [Official repository](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) |
| TRELLIS.2 | permissive-open-weights | [MIT](https://github.com/microsoft/TRELLIS.2#license) | [Official repository](https://github.com/microsoft/TRELLIS.2) |
| TripoSR | permissive-open-weights | [MIT](https://github.com/VAST-AI-Research/TripoSR) | [Official repository](https://github.com/VAST-AI-Research/TripoSR) |
| Stable Fast 3D | restricted-open-weights | [Stability AI Community License](https://github.com/Stability-AI/stable-fast-3d/blob/main/LICENSE.md) | [Official repository](https://github.com/Stability-AI/stable-fast-3d) |
| InstantMesh | permissive-open-weights | [Apache-2.0](https://huggingface.co/TencentARC/InstantMesh) | [Official repository](https://github.com/TencentARC/InstantMesh) |
| ACE-Step 1.5 | permissive-open-weights | [MIT (project declaration; verify selected checkpoint)](https://github.com/ace-step/ACE-Step-1.5#license--disclaimer) | [Official repository](https://github.com/ace-step/ACE-Step-1.5) |
| YuE2 | restricted-open-weights | [CC-BY-NC-4.0 + additional creator permission](https://github.com/multimodal-art-projection/YuE/blob/main/MODEL_LICENSE) | [Official repository](https://github.com/multimodal-art-projection/YuE) |
| MusicGen | restricted-open-weights | [CC-BY-NC-4.0](https://github.com/facebookresearch/audiocraft#license) | [Official repository](https://github.com/facebookresearch/audiocraft) |
| Stable Audio Open 1.0 | restricted-open-weights | [Stability AI Community License](https://huggingface.co/stabilityai/stable-audio-open-1.0) | [Official repository](https://github.com/Stability-AI/stable-audio-tools) |
| TangoFlux | research-restricted | [Research-only; Stability and dataset terms](https://github.com/declare-lab/TangoFlux#license) | [Official repository](https://github.com/declare-lab/TangoFlux) |
| Kokoro 82M | permissive-open-weights | [Apache-2.0](https://huggingface.co/hexgrad/Kokoro-82M) | [Official repository](https://github.com/hexgrad/kokoro) |
| F5-TTS | restricted-open-weights | [CC-BY-NC-4.0](https://github.com/SWivid/F5-TTS#license) | [Official repository](https://github.com/SWivid/F5-TTS) |
| Fun-CosyVoice 3.0 | permissive-open-weights | [Apache-2.0](https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512) | [Official repository](https://github.com/QwenAudio/CosyVoice) |
| Whisper | permissive-open-weights | [MIT](https://github.com/openai/whisper#license) | [Official repository](https://github.com/openai/whisper) |
| SenseVoiceSmall | restricted-open-weights | [FunASR Model Open Source License Agreement](https://github.com/QwenAudio/SenseVoice#license) | [Official repository](https://github.com/QwenAudio/SenseVoice) |
| Demucs | code-open-weights-available | [See official checkpoint distribution](https://github.com/facebookresearch/demucs) | [Official repository](https://github.com/facebookresearch/demucs) |
| SAM 2.1 | permissive-open-weights | [Apache-2.0](https://github.com/facebookresearch/sam2#license) | [Official repository](https://github.com/facebookresearch/sam2) |
| Real-ESRGAN | code-open-weights-available | [See official checkpoint distribution](https://github.com/xinntao/Real-ESRGAN) | [Official repository](https://github.com/xinntao/Real-ESRGAN) |
| SwinIR | code-open-weights-available | [See official checkpoint distribution](https://github.com/JingyunLiang/SwinIR) | [Official repository](https://github.com/JingyunLiang/SwinIR) |
| LivePortrait | mixed-dependency-restrictions | [MIT core; InsightFace dependency restricted](https://github.com/KlingAIResearch/LivePortrait/blob/main/LICENSE) | [Official repository](https://github.com/KlingAIResearch/LivePortrait) |
| Wav2Lip | research-restricted | [Non-commercial research/personal terms](https://github.com/Rudrabha/Wav2Lip#disclaimer) | [Official repository](https://github.com/Rudrabha/Wav2Lip) |
| Practical RIFE | permissive-open-weights | [MIT (official linked models)](https://github.com/hzwer/Practical-RIFE) | [Official repository](https://github.com/hzwer/Practical-RIFE) |
| VGGT | restricted-open-weights | [VGGT License; checkpoint-specific](https://github.com/facebookresearch/vggt/blob/main/LICENSE.txt) | [Official repository](https://github.com/facebookresearch/vggt) |
| Depth Anything V2 Small | permissive-open-weights | [Apache-2.0 (Small only)](https://github.com/DepthAnything/Depth-Anything-V2#license) | [Official repository](https://github.com/DepthAnything/Depth-Anything-V2) |
| Human Motion Diffusion Model | mixed-dependency-restrictions | [Model/data dependencies require separate review](https://github.com/GuyTevet/motion-diffusion-model#license) | [Official repository](https://github.com/GuyTevet/motion-diffusion-model) |
| Qwen3 | permissive-open-weights | [Apache-2.0](https://github.com/QwenLM/Qwen3#license-agreement) | [Official repository](https://github.com/QwenLM/Qwen3) |
| Qwen3-VL | permissive-open-weights | [Apache-2.0](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct) | [Official repository](https://github.com/QwenLM/Qwen3-VL) |
| BGE-M3 | permissive-open-weights | [MIT](https://huggingface.co/BAAI/bge-m3) | [Official repository](https://github.com/FlagOpen/FlagEmbedding) |
| DINOv2 | permissive-open-weights | [Apache-2.0](https://github.com/facebookresearch/dinov2#license) | [Official repository](https://github.com/facebookresearch/dinov2) |

## Hardware and deployment assumptions

Only a few entries carry numeric VRAM values, and those are attributed to the upstream project rather than represented as local measurements. HunyuanVideo-1.5 lists 14 GB with model offloading; TripoSR describes about 6 GB for the default single-image configuration; SANA describes selected 4-bit/offloaded configurations at 8 GB. All other entries remain unknown pending a reproducible run. These numbers cannot certify any specific 5090 driver/PyTorch build, resolution, batch size, or throughput.

Four deployment recipe families are included in models.json: Ollama + Qwen3, ComfyUI for visual models, isolated TripoSR, and isolated Kokoro. They are explicit plans, not claims that the user’s computer has already been configured. The web application can search and generate a reviewable manifest; actual local execution belongs to a paired companion process with an allowlisted recipe runner.

The runner should bind to loopback, verify Origin and Host, require a fresh random pairing token, reject arbitrary shell strings and user-selected download hosts, pin checksummed assets, expose cancellation and progress, and require local review before large downloads or installations. HTTPS-to-localhost browser restrictions need a real bridge or local UI; they cannot be solved by labeling a button “installed.”

The chat system can start with deterministic bilingual catalog retrieval and hardware/license filters, then optionally use a local Ollama model to explain retrieved records. Retrieved text must never become executable installer code. When no local model is available, disclose the deterministic retrieval fallback.

## Suggested Arena protocol

A comparison is valid only after real outputs exist. Randomize left/right assignment and conceal identities. Use matched prompts and documented equal-output or equal-compute budgets. Support ties and both-bad outcomes. Keep quality preference scores separate from latency, VRAM, and project popularity. Register exact model/run manifests and sample hashes; gate leaderboard inclusion on independent effective voters, prompt coverage, and uncertainty. Missing evidence stays missing.
