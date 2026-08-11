# K8s + CI/CD Challenge — Node.js API + Postgres on Kind

Minimal production-style stack: Express API backed by Postgres, deployed to a Kind cluster, with a GitHub Actions pipeline that builds, deploys, and smoke-tests on every push to `main`.

## Architecture

```
GitHub push → Actions: build image → Kind (in CI) → kubectl apply → rollout → smoke test
Locally:      docker build → kind load → kubectl apply → port-forward → curl
```

- `backend` — Node.js Express API, 2 replicas, readiness/liveness probes, resource limits
- `postgres` — single replica, credentials from a K8s Secret, pg_isready readiness probe
- Backend reaches Postgres via the `postgres` ClusterIP Service (K8s DNS)

## Local setup

```bash
kind create cluster --name demo
docker build -t k8s-demo-api:latest ./app
kind load docker-image k8s-demo-api:latest --name demo
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl rollout status deployment/postgres
kubectl rollout status deployment/backend
kubectl port-forward svc/backend 8080:80
curl http://localhost:8080/
curl http://localhost:8080/readyz
```

## Reliability improvement: readiness + liveness probes

Liveness (`/healthz`) restarts a hung process; deliberately does not check the DB (a restart can't fix a down database, and DB-checking liveness causes restart storms). Readiness (`/readyz`) checks DB connectivity; unready pods are pulled from the Service so users never hit a 500, and bad rollouts never receive traffic. Tradeoff: probe overhead per replica, and if the DB dies all pods go unready (zero endpoints) — thresholds need per-workload tuning.

## Failure simulation: bad DB password

```bash
kubectl patch secret db-credentials -p '{"stringData":{"DB_PASSWORD":"wrongpassword"}}'
kubectl rollout restart deployment/backend
# debug: kubectl get pods / describe pod / logs → auth failure → check secret
kubectl patch secret db-credentials -p '{"stringData":{"DB_PASSWORD":"supersecret123"}}'
kubectl rollout restart deployment/backend
```

## Intentional simplifications

Postgres on emptyDir (real: StatefulSet + PVC or managed DB); Secret in plain YAML (real: External Secrets/Vault); `latest` tag loaded into Kind (real: SHA tags in a registry); no ingress (real: ingress-nginx + TLS); CI deploys to a throwaway cluster (real: push to registry + ArgoCD).
