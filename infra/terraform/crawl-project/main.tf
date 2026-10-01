# =============================================================================
# Crawl Project Infrastructure
# =============================================================================
# This Terraform module defines all resources in the crawl project:
# - Cloud Run Jobs (crawl-job, render-job)
# - Service Accounts for each job
# - Landing bucket for raw crawl artifacts (short-lived)
# - VPC with egress firewall rules (deny private, allow public 80/443)
# - Cloud NAT with static egress IP
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

variable "crawl_project" {
  description = "GCP project ID for the crawl project"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "landing_bucket_name" {
  description = "Name of the landing bucket for raw crawl artifacts"
  type        = string
}

variable "crawl_job_image" {
  description = "Container image URL for the crawl job"
  type        = string
  default     = "gcr.io/PLACEHOLDER/crawl-job:latest"
}

variable "render_job_image" {
  description = "Container image URL for the render job"
  type        = string
  default     = "gcr.io/PLACEHOLDER/render-job:latest"
}

# -----------------------------------------------------------------------------
# Service Accounts
# -----------------------------------------------------------------------------

# Service account for the crawl job - used to write to landing bucket
resource "google_service_account" "crawl_job_sa" {
  project      = var.crawl_project
  account_id   = "crawl-job-sa"
  display_name = "Crawl Job Service Account"
  description  = "Identity for the crawl-job Cloud Run Job"
}

# Service account for the render job - used to read/write landing bucket
resource "google_service_account" "render_job_sa" {
  project      = var.crawl_project
  account_id   = "render-job-sa"
  display_name = "Render Job Service Account"
  description  = "Identity for the render-job Cloud Run Job"
}

# -----------------------------------------------------------------------------
# Cloud Run Jobs
# -----------------------------------------------------------------------------

# Crawl job: launches headless browser crawl, writes raw evidence to landing bucket
# Resources: 2 CPU, 4 GB memory, 15 minute timeout
resource "google_cloud_run_v2_job" "crawl_job" {
  project  = var.crawl_project
  name     = "crawl-job"
  location = var.region

  template {
    template {
      service_account = google_service_account.crawl_job_sa.email
      timeout         = "900s" # 15 minutes

      containers {
        image = var.crawl_job_image

        resources {
          limits = {
            cpu    = "2"
            memory = "4Gi"
          }
        }

        env {
          name  = "LANDING_BUCKET"
          value = var.landing_bucket_name
        }
      }

      vpc_access {
        network_interfaces {
          network = google_compute_network.crawl_vpc.id
        }
        egress = "ALL_TRAFFIC"
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }
}

# Render job: renders crawled pages with Playwright, writes rendered evidence
# Resources: 2 CPU, 2 GB memory, 5 minute timeout
resource "google_cloud_run_v2_job" "render_job" {
  project  = var.crawl_project
  name     = "render-job"
  location = var.region

  template {
    template {
      service_account = google_service_account.render_job_sa.email
      timeout         = "300s" # 5 minutes

      containers {
        image = var.render_job_image

        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }

        env {
          name  = "LANDING_BUCKET"
          value = var.landing_bucket_name
        }
      }

      vpc_access {
        network_interfaces {
          network = google_compute_network.crawl_vpc.id
        }
        egress = "ALL_TRAFFIC"
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
# Landing Bucket
# -----------------------------------------------------------------------------

# Short-lived storage for raw crawl artifacts before evidence processing
# 1-day retention ensures stale data is automatically cleaned up
resource "google_storage_bucket" "landing_bucket" {
  project                     = var.crawl_project
  name                        = var.landing_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 1
    }
    action {
      type = "Delete"
    }
  }
}

# Grant crawl-job-sa write access to landing bucket
resource "google_storage_bucket_iam_member" "crawl_job_landing_writer" {
  bucket = google_storage_bucket.landing_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.crawl_job_sa.email}"
}

# Grant render-job-sa read/write access to landing bucket
resource "google_storage_bucket_iam_member" "render_job_landing_writer" {
  bucket = google_storage_bucket.landing_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.render_job_sa.email}"
}

# -----------------------------------------------------------------------------
# VPC Network
# -----------------------------------------------------------------------------

# VPC for crawl jobs - isolates crawl traffic and enforces egress rules
resource "google_compute_network" "crawl_vpc" {
  project                 = var.crawl_project
  name                    = "crawl-vpc"
  auto_create_subnetworks = false
}

# Subnet for Cloud Run VPC access
resource "google_compute_subnetwork" "crawl_subnet" {
  project       = var.crawl_project
  name          = "crawl-subnet"
  region        = var.region
  network       = google_compute_network.crawl_vpc.id
  ip_cidr_range = "10.0.0.0/28"

  private_ip_google_access = true
}

# -----------------------------------------------------------------------------
# Firewall Rules - SSRF Defense
# -----------------------------------------------------------------------------

# Deny egress to all private/internal IP ranges to prevent SSRF attacks
resource "google_compute_firewall" "deny_private_egress" {
  project = var.crawl_project
  name    = "deny-private-egress"
  network = google_compute_network.crawl_vpc.name
  direction = "EGRESS"
  priority  = 1000

  deny {
    protocol = "all"
  }

  destination_ranges = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "169.254.0.0/16",
    "127.0.0.0/8",
    "100.64.0.0/10",
    "192.0.0.0/24",
    "192.0.2.0/24",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "224.0.0.0/4",
    "240.0.0.0/4",
    "fc00::/7",
    "fe80::/10",
    "ff00::/8",
  ]
}

# Allow egress to public internet on HTTP/HTTPS only
resource "google_compute_firewall" "allow_public_http_egress" {
  project = var.crawl_project
  name    = "allow-public-http-egress"
  network = google_compute_network.crawl_vpc.name
  direction = "EGRESS"
  priority  = 1100

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  destination_ranges = [
    "0.0.0.0/0",
    "::/0",
  ]
}

# Allow egress to Google APIs (required for GCS access)
resource "google_compute_firewall" "allow_google_apis_egress" {
  project = var.crawl_project
  name    = "allow-google-apis-egress"
  network = google_compute_network.crawl_vpc.name
  direction = "EGRESS"
  priority  = 900

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  destination_ranges = [
    "199.36.153.8/30",
    "199.36.153.4/30",
  ]
}

# -----------------------------------------------------------------------------
# Cloud Router + Cloud NAT (Static Egress IP)
# -----------------------------------------------------------------------------

# Cloud Router for NAT gateway
resource "google_compute_router" "crawl_router" {
  project = var.crawl_project
  name    = "crawl-router"
  region  = var.region
  network = google_compute_network.crawl_vpc.id
}

# Static external IP for egress (used for allowlisting)
resource "google_compute_address" "static_egress_ip" {
  project      = var.crawl_project
  name         = "crawl-egress-ip"
  region       = var.region
  network_tier = "PREMIUM"
}

# Cloud NAT configuration with static egress IP
resource "google_compute_router_nat" "crawl_nat" {
  project                            = var.crawl_project
  name                               = "crawl-nat"
  router                             = google_compute_router.crawl_router.name
  region                             = var.region
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [google_compute_address.static_egress_ip.self_link]
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "crawl_job_sa_email" {
  description = "Email of the crawl-job service account"
  value       = google_service_account.crawl_job_sa.email
}

output "render_job_sa_email" {
  description = "Email of the render-job service account"
  value       = google_service_account.render_job_sa.email
}

output "landing_bucket_name" {
  description = "Name of the landing bucket"
  value       = google_storage_bucket.landing_bucket.name
}

output "landing_bucket_self_link" {
  description = "Self link of the landing bucket"
  value       = google_storage_bucket.landing_bucket.self_link
}

output "static_egress_ip" {
  description = "Static egress IP address for crawl jobs"
  value       = google_compute_address.static_egress_ip.address
}
