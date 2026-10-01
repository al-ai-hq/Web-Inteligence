# =============================================================================
# App Project Infrastructure
# =============================================================================
# This Terraform module defines all resources in the app project:
# - Cloud Run Job: evidence-processor
# - Cloud Run Services: Next.js app, API (placeholders)
# - Evidence bucket (versioned, 30-day retention)
# - Service Accounts: evidence-processor-sa, workflow-sa
# - Cloud Workflows: audit-pipeline
# - Placeholders: Cloud SQL, Secret Manager
#
# Part of M1 Secure Crawler and Evidence Capture
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------

variable "app_project" {
  description = "GCP project ID for the app project"
  type        = string
}

variable "crawl_project" {
  description = "GCP project ID for the crawl project (for cross-project references)"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "evidence_bucket_name" {
  description = "Name of the evidence bucket for processed audit artifacts"
  type        = string
}

variable "landing_bucket_name" {
  description = "Name of the landing bucket in the crawl project"
  type        = string
}

variable "evidence_processor_image" {
  description = "Container image URL for the evidence processor job"
  type        = string
  default     = "gcr.io/PLACEHOLDER/evidence-processor:latest"
}

variable "workflow_source_path" {
  description = "Path to the workflow definition file"
  type        = string
  default     = "workflows/audit-workflow.yaml"
}

# -----------------------------------------------------------------------------
# Service Accounts
# -----------------------------------------------------------------------------

# Service account for the evidence processor job
resource "google_service_account" "evidence_processor_sa" {
  project      = var.app_project
  account_id   = "evidence-processor-sa"
  display_name = "Evidence Processor Service Account"
  description  = "Identity for the evidence-processor Cloud Run Job"
}

# Service account for the Cloud Workflow
resource "google_service_account" "workflow_sa" {
  project      = var.app_project
  account_id   = "workflow-sa"
  display_name = "Workflow Service Account"
  description  = "Identity for the audit-pipeline Cloud Workflow"
}

# -----------------------------------------------------------------------------
# Cloud Run Job: Evidence Processor
# -----------------------------------------------------------------------------

# Evidence processor: validates, normalizes, and stores crawl evidence
# Resources: 1 CPU, 2 GB memory, 10 minute timeout
resource "google_cloud_run_v2_job" "evidence_processor" {
  project  = var.app_project
  name     = "evidence-processor"
  location = var.region

  template {
    template {
      service_account = google_service_account.evidence_processor_sa.email
      timeout         = "600s" # 10 minutes

      containers {
        image = var.evidence_processor_image

        resources {
          limits = {
            cpu    = "1"
            memory = "2Gi"
          }
        }

        env {
          name  = "EVIDENCE_BUCKET"
          value = var.evidence_bucket_name
        }

        env {
          name  = "LANDING_BUCKET"
          value = var.landing_bucket_name
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }
}

# -----------------------------------------------------------------------------
# Evidence Bucket
# -----------------------------------------------------------------------------

# Long-lived storage for processed audit evidence
# Versioning enabled for tamper detection; 30-day retention for lifecycle management
resource "google_storage_bucket" "evidence_bucket" {
  project                     = var.app_project
  name                        = var.evidence_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age                = 30
      is_live            = true
      num_newer_versions = 3
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      age                = 90
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }
}

# Grant evidence-processor-sa write access to evidence bucket
resource "google_storage_bucket_iam_member" "evidence_processor_writer" {
  bucket = google_storage_bucket.evidence_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.evidence_processor_sa.email}"
}

# -----------------------------------------------------------------------------
# Cloud Workflows: Audit Pipeline
# -----------------------------------------------------------------------------

# Orchestrates the full audit pipeline: crawl -> render -> evidence processing
resource "google_workflows_workflow" "audit_pipeline" {
  project         = var.app_project
  name            = "audit-pipeline"
  region          = var.region
  description     = "Orchestrates the secure crawler audit pipeline"
  service_account = google_service_account.workflow_sa.id

  source_contents = file("${path.module}/../../../${var.workflow_source_path}")

  call_log_level = "CALL_LOG_LEVEL_ALL"
}

# -----------------------------------------------------------------------------
# Cloud Run Services (Placeholders)
# -----------------------------------------------------------------------------

# Placeholder: Next.js application
resource "google_cloud_run_v2_service" "nextjs_app" {
  project  = var.app_project
  name     = "nextjs-app"
  location = var.region

  template {
    containers {
      image = "gcr.io/PLACEHOLDER/nextjs-app:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }
}

# Placeholder: API service
resource "google_cloud_run_v2_service" "api_service" {
  project  = var.app_project
  name     = "api"
  location = var.region

  template {
    containers {
      image = "gcr.io/PLACEHOLDER/api:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }
}

# -----------------------------------------------------------------------------
# Cloud SQL (Placeholder)
# -----------------------------------------------------------------------------

# Placeholder: PostgreSQL instance for application data
resource "google_sql_database_instance" "app_db" {
  project          = var.app_project
  name             = "app-db"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-f1-micro"

    ip_configuration {
      ipv4_enabled    = false
      private_network = null
    }

    backup_configuration {
      enabled = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "app_database" {
  project  = var.app_project
  name     = "app"
  instance = google_sql_database_instance.app_db.name
}

# -----------------------------------------------------------------------------
# Secret Manager (Placeholder)
# -----------------------------------------------------------------------------

# Placeholder: Secret for database credentials
resource "google_secret_manager_secret" "db_credentials" {
  project   = var.app_project
  secret_id = "db-credentials"

  replication {
    auto {}
  }
}

# Placeholder: Secret for API keys
resource "google_secret_manager_secret" "api_keys" {
  project   = var.app_project
  secret_id = "api-keys"

  replication {
    auto {}
  }
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "evidence_processor_sa_email" {
  description = "Email of the evidence-processor service account"
  value       = google_service_account.evidence_processor_sa.email
}

output "workflow_sa_email" {
  description = "Email of the workflow service account"
  value       = google_service_account.workflow_sa.email
}

output "evidence_bucket_name" {
  description = "Name of the evidence bucket"
  value       = google_storage_bucket.evidence_bucket.name
}

output "evidence_bucket_self_link" {
  description = "Self link of the evidence bucket"
  value       = google_storage_bucket.evidence_bucket.self_link
}

output "workflow_id" {
  description = "ID of the audit-pipeline workflow"
  value       = google_workflows_workflow.audit_pipeline.id
}
