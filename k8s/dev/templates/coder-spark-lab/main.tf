terraform {
  required_providers {
    coder = {
      source = "coder/coder"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "coder" {}
provider "kubernetes" {}
provider "random" {}

data "coder_provisioner" "me" {}
data "coder_workspace" "me" {}
data "coder_workspace_owner" "me" {}

variable "workspaces_namespace" {
  type        = string
  description = "Namespace for Coder workspace pods"
  default     = "coder-workspaces"
}

variable "workspace_image" {
  type        = string
  description = "Dev workspace container image"
  default     = "spark-lab-coder-workspace:latest"
}

variable "repo_url" {
  type        = string
  description = "Git repository to clone into the workspace"
  default     = "https://github.com/NVIDIA/dgx-spark-playbooks.git"
}

variable "cpu_cores" {
  type        = number
  description = "CPU cores for the dev container"
  default     = 2
}

variable "memory_gb" {
  type        = number
  description = "Memory (GiB) for the dev container"
  default     = 4
}

resource "random_password" "hermes_api_key" {
  length  = 64
  special = false
}

resource "random_password" "hermes_dashboard_secret" {
  length  = 64
  special = false
}

resource "random_password" "hermes_dashboard_password" {
  length  = 24
  special = false
}

resource "kubernetes_namespace" "workspaces" {
  count = data.coder_workspace.me.start_count
  metadata {
    name = var.workspaces_namespace
    labels = {
      "app.kubernetes.io/part-of" = "nvidia-dgx-spark-lab"
      "lab.tier"                  = "optional_dev"
    }
  }
}

resource "kubernetes_config_map" "hermes_seed" {
  count = data.coder_workspace.me.start_count
  metadata {
    name      = "hermes-seed-${lower(data.coder_workspace_owner.me.name)}-${lower(data.coder_workspace.me.name)}"
    namespace = var.workspaces_namespace
  }
  data = {
    "config.yaml"       = file("${path.module}/hermes-seed/config.yaml")
    "SOUL.md"           = file("${path.module}/hermes-seed/SOUL.md")
    "mcp.json"          = file("${path.module}/hermes-seed/mcp.json")
    "distribution.yaml" = file("${path.module}/hermes-seed/distribution.yaml")
  }
  depends_on = [kubernetes_namespace.workspaces]
}

resource "kubernetes_secret" "hermes_auth" {
  count = data.coder_workspace.me.start_count
  metadata {
    name      = "hermes-auth-${lower(data.coder_workspace_owner.me.name)}-${lower(data.coder_workspace.me.name)}"
    namespace = var.workspaces_namespace
  }
  type = "Opaque"
  data = {
    API_SERVER_KEY                          = random_password.hermes_api_key.result
    HERMES_DASHBOARD_BASIC_AUTH_USERNAME    = "coder"
    HERMES_DASHBOARD_BASIC_AUTH_PASSWORD    = random_password.hermes_dashboard_password.result
    HERMES_DASHBOARD_BASIC_AUTH_SECRET      = random_password.hermes_dashboard_secret.result
    OPENAI_API_KEY                          = "none"
  }
  depends_on = [kubernetes_namespace.workspaces]
}

resource "kubernetes_persistent_volume_claim" "hermes_data" {
  count = data.coder_workspace.me.start_count
  metadata {
    name      = "hermes-data-${lower(data.coder_workspace_owner.me.name)}-${lower(data.coder_workspace.me.name)}"
    namespace = var.workspaces_namespace
  }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "5Gi"
      }
    }
  }
  depends_on = [kubernetes_namespace.workspaces]
}

resource "coder_agent" "main" {
  arch = data.coder_provisioner.me.arch
  os   = "linux"
  dir  = "/home/coder"

  metadata {
    display_name = "CPU"
    key          = "cpu"
    script       = "coder stat cpu"
  }

  metadata {
    display_name = "Memory"
    key          = "memory"
    script       = "coder stat mem"
  }

  env = {
    HERMES_GATEWAY_URL    = "http://127.0.0.1:8642/v1"
    HERMES_DASHBOARD_URL  = "http://127.0.0.1:9119"
    HERMES_API_KEY        = random_password.hermes_api_key.result
  }

  startup_script = <<-EOT
    #!/bin/bash
    set -euo pipefail
    if [ ! -d "$HOME/nvidia-dgx-spark-lab/.git" ]; then
      git clone --depth 1 "${var.repo_url}" "$HOME/nvidia-dgx-spark-lab" || true
    fi
    /usr/local/bin/workspace-init.sh || true
  EOT
}

resource "coder_app" "hermes_dashboard" {
  agent_id     = coder_agent.main.id
  slug         = "hermes"
  display_name = "Hermes Dev Assistant"
  icon         = "/icon/spark.svg"
  url          = "http://localhost:9119"
  subdomain    = false
  share        = "owner"
}

resource "coder_app" "hermes_gateway" {
  agent_id     = coder_agent.main.id
  slug         = "hermes-api"
  display_name = "Hermes Gateway API"
  url          = "http://localhost:8642"
  subdomain    = false
  share        = "owner"
  hidden       = true
}

resource "kubernetes_pod" "workspace" {
  count = data.coder_workspace.me.start_count
  metadata {
    name      = "coder-${lower(data.coder_workspace_owner.me.name)}-${lower(data.coder_workspace.me.name)}"
    namespace = var.workspaces_namespace
    labels = {
      "app.kubernetes.io/name" = "coder-workspace"
      "coder.workspace"      = data.coder_workspace.me.name
    }
  }

  spec {
    restart_policy = "Never"

    volume {
      name = "hermes-data"
      persistent_volume_claim {
        claim_name = kubernetes_persistent_volume_claim.hermes_data[0].metadata[0].name
      }
    }

    volume {
      name = "hermes-seed"
      config_map {
        name = kubernetes_config_map.hermes_seed[0].metadata[0].name
      }
    }

    volume {
      name = "hermes-shm"
      empty_dir {
        medium = "Memory"
        size_limit = "1Gi"
      }
    }

    init_container {
      name  = "hermes-seed"
      image = "busybox:1.36"
      command = [
        "sh", "-c",
        "if [ ! -f /opt/data/config.yaml ]; then cp -a /seed/. /opt/data/; fi && chown -R 10000:10000 /opt/data || true"
      ]
      volume_mount {
        name       = "hermes-seed"
        mount_path = "/seed"
      }
      volume_mount {
        name       = "hermes-data"
        mount_path = "/opt/data"
      }
    }

    container {
      name  = "dev"
      image = var.workspace_image
      command = ["sh", "-c", coder_agent.main.init_script]
      env {
        name  = "CODER_AGENT_TOKEN"
        value = coder_agent.main.token
      }
      env {
        name  = "HERMES_GATEWAY_URL"
        value = "http://127.0.0.1:8642/v1"
      }
      env {
        name  = "HERMES_DASHBOARD_URL"
        value = "http://127.0.0.1:9119"
      }
      env {
        name  = "HERMES_API_KEY"
        value = random_password.hermes_api_key.result
      }
      resources {
        requests = {
          cpu    = "${var.cpu_cores}"
          memory = "${var.memory_gb}Gi"
        }
        limits = {
          cpu    = "${var.cpu_cores}"
          memory = "${var.memory_gb}Gi"
        }
      }
    }

    container {
      name    = "hermes"
      image   = "nousresearch/hermes-agent:latest"
      command = ["gateway", "run"]
      env {
        name  = "HERMES_DASHBOARD"
        value = "1"
      }
      env {
        name  = "API_SERVER_ENABLED"
        value = "true"
      }
      env {
        name  = "API_SERVER_HOST"
        value = "0.0.0.0"
      }
      env_from {
        secret_ref {
          name = kubernetes_secret.hermes_auth[0].metadata[0].name
        }
      }
      volume_mount {
        name       = "hermes-data"
        mount_path = "/opt/data"
      }
      volume_mount {
        name       = "hermes-shm"
        mount_path = "/dev/shm"
      }
      resources {
        requests = {
          cpu    = "500m"
          memory = "1Gi"
        }
        limits = {
          cpu    = "2"
          memory = "4Gi"
        }
      }
    }
  }

  depends_on = [
    kubernetes_namespace.workspaces,
    kubernetes_config_map.hermes_seed,
    kubernetes_secret.hermes_auth,
    kubernetes_persistent_volume_claim.hermes_data,
  ]
}