import os
import logging

def resolve_path(source_uri: str, is_rtsp: bool) -> str:
    """Resolve relative path → absolute dựa trên project root."""
    if is_rtsp:
        return source_uri

    project_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )

    if os.path.isabs(source_uri):
        if os.path.exists(source_uri):
            return source_uri
        
        # If absolute path does not exist on this machine, attempt suffix matching
        normalized = source_uri.replace('/', os.sep).replace('\\', os.sep)
        parts = [p for p in normalized.split(os.sep) if p and not p.endswith(':')]
        for i in range(len(parts)):
            subpath = os.path.join(*parts[i:])
            resolved = os.path.join(project_root, subpath)
            if os.path.exists(resolved):
                logging.info(f"[PathUtils] Resolved absolute path mismatch: {source_uri} → {resolved}")
                return resolved

    resolved = os.path.join(project_root, source_uri)
    if os.path.exists(resolved):
        logging.info(f"[PathUtils] Resolved: {source_uri} → {resolved}")
        return resolved
    logging.warning(
        f"[PathUtils] Cannot resolve '{source_uri}' from root '{project_root}'"
    )
    return source_uri
