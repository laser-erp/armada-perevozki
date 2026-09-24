#!/usr/bin/env python3
"""Windows fallback: staging deploy (same as deploy-staging-fvds.sh + deploy-fvds.sh)."""
import os
import re
import shutil
import sys
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_PREVIEW = ROOT / "web-preview"
HOST = os.environ.get("FVDS_HOST", "176.12.67.35")
USER = os.environ.get("FVDS_USER", "root")
DEST = os.environ.get("FVDS_STAGING_PATH", "/var/www/armada-staging")
DEPLOY_URL = os.environ.get("ARMADA_STAGING_URL", "https://staging.app.armada.sx")


def load_password() -> str:
    pw = os.environ.get("FVDS_SSH_PASSWORD") or os.environ.get("root", "")
    if not pw:
        f = ROOT / ".fvds-ssh-password"
        if f.is_file():
            pw = f.read_text(encoding="utf-8").strip()
    if not pw:
        print("Нет пароля: .fvds-ssh-password или FVDS_SSH_PASSWORD", file=sys.stderr)
        sys.exit(1)
    return pw


def patch_staging_banner(index_path: Path) -> None:
    banner = (
        '<div id="armada-staging-banner" role="status" aria-label="Среда staging" '
        'style="position:fixed;left:0;right:0;top:0;z-index:99999;height:3px;'
        'background:linear-gradient(90deg,#b45309,#f59e0b);pointer-events:none"></div>'
        '<a id="armada-staging-chip" href="https://app.armada.sx/" '
        'style="position:fixed;top:max(6px,env(safe-area-inset-top,0px));right:max(6px,env(safe-area-inset-right,0px));'
        'z-index:99999;display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;'
        'font-weight:700;line-height:1.25;letter-spacing:.02em;text-decoration:none;'
        'color:#fff;background:rgba(180,83,9,.88);box-shadow:0 1px 4px rgba(0,0,0,.18)">STAGING</a>'
    )
    text = index_path.read_text(encoding="utf-8")
    text = re.sub(
        r'<div id="armada-staging-banner"[^>]*>.*?</div>\s*',
        "",
        text,
        count=1,
        flags=re.DOTALL,
    )
    text = re.sub(r'<a id="armada-staging-chip"[^>]*>STAGING</a>\s*', "", text)
    text, n = re.subn(r"(<body[^>]*>)", r"\1\n" + banner, text, count=1)
    if n != 1:
        raise SystemExit("не найден <body> в index.html")
    index_path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    import paramiko

    if not SRC_PREVIEW.is_dir():
        sys.exit(f"Нет {SRC_PREVIEW}")

    pw = load_password()
    tmp = Path(tempfile.mkdtemp(prefix="armada-staging-"))
    try:
        shutil.copytree(SRC_PREVIEW, tmp / "web", dirs_exist_ok=True)
        patch_staging_banner(tmp / "web" / "index.html")
        tar_path = tmp / "deploy.tar.gz"
        with tarfile.open(tar_path, "w:gz") as tar:
            tar.add(tmp / "web", arcname=".")

        remote_tar = "/tmp/armada-staging-deploy.tar.gz"
        print(f"-> {USER}@{HOST}:{DEST}")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(HOST, username=USER, password=pw, timeout=120, banner_timeout=120, auth_timeout=120)
        c.exec_command(f"mkdir -p {DEST}")[1].channel.recv_exit_status()
        sftp = c.open_sftp()
        sftp.put(str(tar_path), remote_tar)
        sftp.close()
        for cmd in (
            f"find {DEST} -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {{}} + 2>/dev/null",
            f"tar xzf {remote_tar} -C {DEST}",
            f"rm -f {remote_tar}",
            f"find {DEST} -type d -exec chmod 755 {{}} +",
            f"find {DEST} -type f -exec chmod a+r {{}} +",
            f"grep -m1 APP_BUILD {DEST}/store.js || true",
        ):
            _, out, err = c.exec_command(cmd)
            out.channel.recv_exit_status()
            o = out.read().decode().strip()
            if o and "APP_BUILD" in o:
                print("APP_BUILD на сервере:", o)
        c.close()

        store = (SRC_PREVIEW / "store.js").read_text(encoding="utf-8")
        m = re.search(r'APP_BUILD="([^"]+)"', store)
        build = m.group(1) if m else "?"
        print(f"Gotovo: {DEPLOY_URL}/ (build: {build})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
