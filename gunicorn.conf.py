import multiprocessing
import os

# Server socket
bind = "127.0.0.1:5000"
backlog = 2048

# Worker processes
workers = 2  # まずは固定値で
worker_class = "sync"
worker_connections = 1000
timeout = 60
keepalive = 2

# Restart workers after this many requests
max_requests = 1000
max_requests_jitter = 100

# Load application code before the worker processes are forked
preload_app = True

# Logging - 簡単な設定
errorlog = "-"  # stderr
accesslog = "-"  # stdout
loglevel = "info"

# Process naming
proc_name = "pdfcutter"

# Server mechanics
daemon = False
user = "ubuntu"
group = "ubuntu"
