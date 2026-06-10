# 🚀 TaskFlow — Step-by-Step GitOps on AKS
### Helm + ArgoCD + GitHub Actions on KodeKloud Azure Playground

---

## What You'll Build

A real GitOps pipeline where:
1. You push code to GitHub
2. GitHub Actions builds Docker images and pushes them to Docker Hub
3. GitHub Actions updates `values.yaml` with the new image tag (the GitOps commit)
4. ArgoCD detects the change in Git and automatically deploys to your AKS cluster

```
You push code
     │
     ▼
GitHub Actions ──builds──▶ Docker Hub
     │
     ▼ (updates values.yaml)
   GitHub (source of truth)
     │
     ▼ ArgoCD watches git
   AKS Cluster ◀──── ArgoCD deploys ──── Helm chart
```

---

## Prerequisites — What You Need

- [ ] KodeKloud Azure Playground (PRO) — running
- [ ] GitHub account — free
- [ ] Docker Hub account — free (hub.docker.com)
- [ ] `kubectl`, `helm`, `az` CLI available in the playground terminal

---

## PHASE 1 — Set Up Your AKS Cluster

### Step 1 — Launch the KodeKloud Playground

1. Log into KodeKloud → Start an **Azure** playground session
2. Open the Cloud Shell or terminal
3. Verify you're connected:
   ```bash
   az account show
   ```
   You should see your subscription info.

---

### Step 2 — Create the AKS Cluster

KodeKloud allows max **2 nodes**, **Standard_B2s** only.

```bash
# Set variables (change RESOURCE_GROUP to match your playground's)
RESOURCE_GROUP="your-playground-rg"   # ← use the existing RG from KodeKloud
CLUSTER_NAME="taskflow-aks"
LOCATION="eastus"

# Create AKS cluster — 2 nodes, B2s (within playground limits)
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --node-count 2 \
  --node-vm-size Standard_B2s \
  --generate-ssh-keys \
  --no-wait

echo "⏳ Cluster is being created... takes ~5 minutes"
```

> **Why `--no-wait`?** It lets the command return immediately so you can do other things while Azure provisions the cluster.

### Step 3 — Connect kubectl to Your Cluster

```bash
# Download credentials (merges into ~/.kube/config)
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME

# Verify connection — you should see 2 nodes
kubectl get nodes
```

Expected output:
```
NAME                                STATUS   ROLES    AGE
aks-nodepool1-12345678-vmss000000   Ready    <none>   2m
aks-nodepool1-12345678-vmss000001   Ready    <none>   2m
```

---

## PHASE 2 — Set Up GitHub Repository

### Step 4 — Push the Project to GitHub

1. Create a **new repo** on GitHub called `taskflow` (make it public)
2. Push the code:

```bash
# On your local machine (or Cloud Shell with git installed)
cd taskflow/
git init
git add .
git commit -m "feat: initial TaskFlow project"
git remote add origin https://github.com/YOUR_USERNAME/taskflow.git
git push -u origin main
```

> Replace `YOUR_USERNAME` with your actual GitHub username!

### Step 5 — Add GitHub Secrets

These secrets let GitHub Actions push to Docker Hub:

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:

| Secret Name | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Your Docker Hub access token |

**How to get a Docker Hub token:**
- Log into hub.docker.com → Account Settings → Security → **New Access Token**
- Name it `github-actions`, select Read/Write → copy the token

---

## PHASE 3 — Install ArgoCD on AKS

### Step 6 — Install ArgoCD

```bash
# Create ArgoCD namespace
kubectl create namespace argocd

# Install ArgoCD using the official manifest
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all pods to be Running (takes ~2 minutes)
kubectl wait --for=condition=available \
  --timeout=300s deployment/argocd-server -n argocd

# Check pods
kubectl get pods -n argocd
```

You should see pods like `argocd-server`, `argocd-repo-server`, `argocd-application-controller` all Running.

---

### Step 7 — Access the ArgoCD UI

By default ArgoCD only has a ClusterIP service. Expose it:

```bash
# Patch the service to LoadBalancer so Azure gives it a public IP
kubectl patch svc argocd-server -n argocd \
  -p '{"spec": {"type": "LoadBalancer"}}'

# Wait for the external IP (run this a few times until EXTERNAL-IP shows)
kubectl get svc argocd-server -n argocd
```

```
NAME            TYPE           CLUSTER-IP    EXTERNAL-IP      PORT(S)
argocd-server   LoadBalancer   10.0.x.x      20.xx.xx.xx      80:xxx/TCP,443:xxx/TCP
```

> 💡 Copy the `EXTERNAL-IP` — this is your ArgoCD URL!

**Get the admin password:**
```bash
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath="{.data.password}" | base64 -d && echo
```

**Login:**
- Open `https://EXTERNAL-IP` in your browser
- Username: `admin`
- Password: (the output from above command)
- ✅ Accept the SSL warning (self-signed cert is fine)

---

## PHASE 4 — Configure Helm Values

### Step 8 — Update values.yaml with Your Docker Hub Username

Before deploying, edit `helm/taskflow/values.yaml`:

```bash
# Open the file and replace YOUR_DOCKERHUB_USERNAME
nano helm/taskflow/values.yaml
```

Change both occurrences:
```yaml
# Before:
repository: YOUR_DOCKERHUB_USERNAME/taskflow-frontend

# After (example):
repository: miku123/taskflow-frontend
```

Do the same for backend. Then commit:
```bash
git add helm/taskflow/values.yaml
git commit -m "config: set docker hub username"
git push
```

---

## PHASE 5 — Build and Push Docker Images (CI)

### Step 9 — Trigger the GitHub Actions CI Pipeline

The CI workflow runs automatically on every push to `main`.

1. Go to your GitHub repo → **Actions** tab
2. You should see the **"Build & Push Docker Images"** workflow running
3. Watch the steps: checkout → docker login → build backend → build frontend → update values.yaml

**If it passes** ✅ — your images are on Docker Hub and `values.yaml` has been updated with the new image tag.

**Verify on Docker Hub:**
- Visit `hub.docker.com/u/YOUR_USERNAME`
- You should see `taskflow-frontend` and `taskflow-backend` repositories

---

## PHASE 6 — Register the App in ArgoCD (GitOps!)

### Step 10 — Update argocd/application.yaml

Edit the ArgoCD Application manifest with your GitHub URL:

```bash
nano argocd/application.yaml
```

Change this line:
```yaml
repoURL: https://github.com/YOUR_GITHUB_USERNAME/taskflow  # ← your real URL
```

Commit and push:
```bash
git add argocd/application.yaml
git commit -m "config: set github repo URL for argocd"
git push
```

### Step 11 — Apply the ArgoCD Application

```bash
# This tells ArgoCD: "watch this git repo and deploy using Helm"
kubectl apply -f argocd/application.yaml

# Check status
kubectl get application taskflow -n argocd
```

**Or use the ArgoCD UI:**
1. Open the ArgoCD browser UI
2. Click **"+ NEW APP"**
3. Fill in:
   - Application Name: `taskflow`
   - Project: `default`
   - Sync Policy: **Automatic**
   - Repository URL: your GitHub URL
   - Path: `helm/taskflow`
   - Destination Cluster: `https://kubernetes.default.svc`
   - Namespace: `taskflow`
4. Click **Create**

---

## PHASE 7 — Watch ArgoCD Deploy! 🎉

### Step 12 — Observe the GitOps Magic

In the ArgoCD UI, click on the **taskflow** app. You'll see a visual graph:

```
taskflow
  ├── Deployment/taskflow-frontend  ✅ Synced
  ├── Service/taskflow-frontend     ✅ Synced
  ├── Deployment/taskflow-backend   ✅ Synced
  └── Service/taskflow-backend      ✅ Synced
```

Check from the terminal:
```bash
# See all resources in the taskflow namespace
kubectl get all -n taskflow

# Watch until pods are Running
kubectl get pods -n taskflow -w
```

### Step 13 — Get the Frontend's Public IP

```bash
kubectl get svc taskflow-frontend -n taskflow
```

Copy the `EXTERNAL-IP` and open it in your browser. You should see the **TaskFlow** app! 🎉

---

## PHASE 8 — Test the Full GitOps Loop

### Step 14 — Make a Code Change and Watch It Deploy

This is the GitOps magic moment. Make a small change:

```bash
# Edit the backend to add a new default task
nano backend/server.js
```

Change the initial tasks array, e.g. add a task:
```javascript
let tasks = [
  { id: 1, title: 'Learn Helm', done: false },
  { id: 2, title: 'Deploy with ArgoCD', done: false },
  { id: 3, title: 'Master GitOps', done: false },
  { id: 4, title: 'I changed this via GitOps! 🚀', done: false },  // ← add this
];
```

Commit and push:
```bash
git add backend/server.js
git commit -m "feat: add GitOps demo task"
git push
```

**Watch what happens:**
1. GitHub Actions triggers → builds new Docker image → pushes to Docker Hub
2. CI updates `helm/taskflow/values.yaml` with new tag → commits to git
3. ArgoCD detects the git change → syncs → deploys new pods
4. Refresh your browser → new task appears!

This entire loop typically takes **2-4 minutes**.

---

## Useful Commands Cheat Sheet

```bash
# ArgoCD — force sync manually
kubectl exec -it -n argocd deploy/argocd-server -- \
  argocd app sync taskflow --insecure

# Check ArgoCD app status
kubectl get application -n argocd

# Rollback to previous Helm release
helm history taskflow -n taskflow
helm rollback taskflow 1 -n taskflow

# View pod logs
kubectl logs -n taskflow deploy/taskflow-backend
kubectl logs -n taskflow deploy/taskflow-frontend

# Describe a pod (debugging)
kubectl describe pod -n taskflow -l app=taskflow-backend

# Check Helm release
helm list -n taskflow
helm get values taskflow -n taskflow

# Delete everything (cleanup)
kubectl delete application taskflow -n argocd
helm uninstall taskflow -n taskflow
az aks delete --name taskflow-aks --resource-group $RESOURCE_GROUP --yes
```

---

## What You've Learned 🧠

| Concept | What You Did |
|---|---|
| **Helm** | Packaged both services as a reusable chart with `values.yaml` |
| **ArgoCD** | Installed it on AKS, connected it to your GitHub repo |
| **GitOps** | Git is the single source of truth — a git push triggers deployment |
| **CI/CD** | GitHub Actions builds images and updates Helm values automatically |
| **AKS** | Created a real Azure Kubernetes cluster with 2 nodes |
| **Services** | Used `LoadBalancer` for public access, `ClusterIP` for internal |
| **Health probes** | Configured readiness and liveness probes on both services |

---

## Interview Talking Points 💬

- *"I set up a GitOps pipeline using ArgoCD where the Helm values.yaml is the source of truth — any git push triggers an automated sync to AKS."*
- *"ArgoCD's self-healing means if someone manually changes a resource, it gets reverted to match git within seconds."*
- *"I used a multi-stage Docker build for the React frontend to keep the final image small — build tools don't end up in production."*
- *"The CI pipeline uses `github.sha` as the image tag so every deploy is traceable back to a specific commit."*
