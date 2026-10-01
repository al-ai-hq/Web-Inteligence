# =============================================================================
# Cross-Project IAM Bindings
# =============================================================================
# This Terraform module defines IAM bindings that span the crawl and app
# projects, enabling the audit pipeline to function across project boundaries.
#
# Bindings:
# - evidence-processor-sa (app project) reads from landing bucket (crawl project)
# - workflow-sa (app project) invokes crawl-job and render-job (crawl project)
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
  }
}

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------

variable "crawl_project" {
  description = "GCP project ID for the crawl project"
  type        = string
}

variable "app_project" {
  description = "GCP project ID for the app project"
  type        = string
}

variable "evidence_processor_sa_email" {
  description = "Email of the evidence-processor service account (app project)"
  type        = string
}

variable "workflow_sa_email" {
  description = "Email of the workflow service account (app project)"
  type        = string
}

variable "landing_bucket_name" {
  description = "Name of the landing bucket in the crawl project"
  type        = string
}

variable "crawl_project_number" {
  description = "Project number of the crawl project (for resource name construction)"
  type        = string
}

# -----------------------------------------------------------------------------
# IAM Binding: evidence-processor-sa reads from landing bucket
# -----------------------------------------------------------------------------

# The evidence processor in the app project needs to read raw crawl artifacts
# from the landing bucket in the crawl project
resource "google_storage_bucket_iam_member" "evidence_processor_landing_viewer" {
  provider = google

  bucket = var.landing_bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${var.evidence_processor_sa_email}"
}

# -----------------------------------------------------------------------------
# IAM Binding: workflow-sa invokes crawl-job in crawl project
# -----------------------------------------------------------------------------

# The workflow in the app project needs to trigger the crawl-job in the crawl project
resource "google_project_iam_member" "workflow_crawl_invoker" {
  project = var.crawl_project
  role    = "roles/run.invoker"
  member  = "serviceAccount:${var.workflow_sa_email}"
}

# -----------------------------------------------------------------------------
# IAM Binding: workflow-sa invokes render-job in crawl project
# -----------------------------------------------------------------------------

# The workflow in the app project needs to trigger the render-job in the crawl project
# Note: roles/run.invoker is granted at the project level above, which covers both
# crawl-job and render-job. For finer-grained control, use per-job bindings:

resource "google_cloud_run_v2_job_iam_member" "workflow_crawl_job_invoker" {
  project  = var.crawl_project
  location = "us-central1"
  name     = "crawl-job"
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.workflow_sa_email}"
}

resource "google_cloud_run_v2_job_iam_member" "workflow_render_job_invoker" {
  project  = var.crawl_project
  location = "us-central1"
  name     = "render-job"
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.workflow_sa_email}"
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "iam_bindings" {
  description = "Summary of cross-project IAM bindings created"
  value = {
    evidence_processor_landing_viewer = {
      member = var.evidence_processor_sa_email
      role   = "roles/storage.objectViewer"
      bucket = var.landing_bucket_name
    }
    workflow_crawl_job_invoker = {
      member = var.workflow_sa_email
      role   = "roles/run.invoker"
      job    = "crawl-job"
    }
    workflow_render_job_invoker = {
      member = var.workflow_sa_email
      role   = "roles/run.invoker"
      job    = "render-job"
    }
  }
}
