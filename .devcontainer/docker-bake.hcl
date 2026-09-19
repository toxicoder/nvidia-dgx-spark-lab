# Local multi-arch bake for the contributor image.
#   cd .devcontainer && docker buildx bake
# Dev Containers CLI still uses devcontainer.json; this file is for CI/humans.

group "default" {
  targets = ["devcontainer"]
}

target "devcontainer" {
  context    = "."
  dockerfile = "Dockerfile"
  platforms  = ["linux/amd64", "linux/arm64"]
  tags = [
    "ghcr.io/toxicoder/nvidia-dgx-spark-lab/devcontainer:local",
  ]
}
