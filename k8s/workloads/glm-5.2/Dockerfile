# syntax=docker/dockerfile:1
# GB10 (sm_121) llama.cpp with RPC — build on aarch64 DGX Spark nodes.
# Build: docker build -t lab/llama-cpp-gb10:rpc .
# Must run on GB10 hardware (or matching CUDA arch) for optimal kernels.

FROM nvidia/cuda:12.6.3-devel-ubuntu24.04 AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    cmake \
    build-essential \
    libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git .

WORKDIR /src/build-rpc
RUN cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_CUDA=ON \
    -DGGML_CUDA_F16=ON \
    -DGGML_CUDA_FA_ALL_QUANTS=ON \
    -DGGML_CUDA_GRAPHS=ON \
    -DCMAKE_CUDA_ARCHITECTURES=121a-real \
    -DGGML_NATIVE=ON \
    -DGGML_LTO=ON \
    -DGGML_OPENMP=ON \
    -DGGML_RPC=ON \
    -DGGML_CURL=ON \
    && cmake --build . -j"$(nproc)" --target llama-server llama-rpc-server

FROM nvidia/cuda:12.6.3-runtime-ubuntu24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libcurl4 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/build-rpc/bin/llama-server /usr/local/bin/llama-server
COPY --from=build /src/build-rpc/bin/llama-rpc-server /usr/local/bin/llama-rpc-server