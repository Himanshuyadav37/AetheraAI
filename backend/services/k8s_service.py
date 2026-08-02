import logging
import yaml
from kubernetes import client, config
from kubernetes.client.rest import ApiException

logger = logging.getLogger(__name__)

def load_kube_config() -> bool:
    """Tries loading in-cluster config, falling back to local kubeconfig file."""
    try:
        config.load_incluster_config()
        logger.info("Loaded Kubernetes in-cluster configuration")
        return True
    except config.ConfigException:
        try:
            config.load_kube_config()
            logger.info("Loaded Kubernetes local kubeconfig file")
            return True
        except config.ConfigException as e:
            logger.error(f"Failed to load any Kubernetes configuration: {e}")
            return False

def verify_k8s_connection() -> dict:
    """Verify connectivity to cluster by querying namespaces."""
    if not load_kube_config():
        return {"status": "error", "message": "Could not load Kubernetes configuration"}
    
    try:
        v1 = client.CoreV1Api()
        namespaces = v1.list_namespace(timeout_seconds=5)
        ns_list = [ns.metadata.name for ns in namespaces.items]
        return {
            "status": "success",
            "message": "Connected to Kubernetes API successfully",
            "namespaces": ns_list
        }
    except ApiException as e:
        logger.error(f"Kubernetes API Exception during connection verify: {e}")
        return {"status": "error", "message": f"Kubernetes API Error: {str(e)}"}
    except Exception as e:
        logger.error(f"Unexpected connection error: {e}")
        return {"status": "error", "message": f"Unexpected Error: {str(e)}"}

def list_pods(namespace: str = "default") -> list:
    """List pods in a specific namespace."""
    if not load_kube_config():
        return []
    
    try:
        v1 = client.CoreV1Api()
        pods = v1.list_namespaced_pod(namespace=namespace, timeout_seconds=10)
        pod_list = []
        for pod in pods.items:
            pod_list.append({
                "name": pod.metadata.name,
                "status": pod.status.phase,
                "ip": pod.status.pod_ip,
                "created_at": pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None
            })
        return pod_list
    except ApiException as e:
        logger.error(f"Error listing pods in namespace {namespace}: {e}")
        return []

def list_deployments(namespace: str = "default") -> list:
    """List deployments in a specific namespace."""
    if not load_kube_config():
        return []
    
    try:
        apps_v1 = client.AppsV1Api()
        deployments = apps_v1.list_namespaced_deployment(namespace=namespace, timeout_seconds=10)
        dep_list = []
        for dep in deployments.items:
            dep_list.append({
                "name": dep.metadata.name,
                "replicas": dep.spec.replicas,
                "available_replicas": dep.status.available_replicas or 0,
                "updated_replicas": dep.status.updated_replicas or 0
            })
        return dep_list
    except ApiException as e:
        logger.error(f"Error listing deployments in namespace {namespace}: {e}")
        return []
