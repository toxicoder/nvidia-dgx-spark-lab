#!/usr/bin/env python3
"""Unit tests for disk_inuse overlay (open files, hostPath, hf pid)."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from disk_catalog import classify_path, load_catalog
from disk_inuse import (
    apply_overlay,
    hf_pid_present,
    load_hostpath_mounts,
    load_open_paths,
    _hf_proc_running,
)
from test_disk_catalog import MINI


class TestDiskInuse(unittest.TestCase):
    """Overlay promotes in-use paths to dangerous."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cat_path = Path(self.tmp.name) / "catalog.yaml"
        self.cat_path.write_text(MINI, encoding="utf-8")
        self.cat = load_catalog(self.cat_path)

    def test_mock_open_files_empty_skips_proc(self) -> None:
        env = {"LAB_MOCK_OPEN_FILES": ""}
        self.assertEqual(load_open_paths(env=env), set())

    def test_mock_open_files_from_file(self) -> None:
        target = Path(self.tmp.name) / "open.bin"
        target.write_bytes(b"x")
        mock = Path(self.tmp.name) / "open.txt"
        mock.write_text(str(target) + "\n", encoding="utf-8")
        got = load_open_paths(str(mock))
        self.assertIn(os.path.realpath(str(target)), got)

    def test_hf_pid_from_env_and_pidfile(self) -> None:
        self.assertTrue(hf_pid_present(env={"LAB_MOCK_HF_PID": "1"}))
        self.assertFalse(hf_pid_present(env={"LAB_MOCK_HF_PID": "0", "MODELS_DIR": self.tmp.name}))
        Path(self.tmp.name, ".hf-download.pid").write_text("1", encoding="utf-8")
        self.assertTrue(hf_pid_present(env={"MODELS_DIR": self.tmp.name}))

    def test_hostpath_from_pods_json(self) -> None:
        blob = {
            "items": [
                {
                    "spec": {
                        "volumes": [
                            {"name": "m", "hostPath": {"path": "/mnt/models"}},
                            {"name": "e", "emptyDir": {}},
                        ]
                    }
                }
            ]
        }
        mounts = load_hostpath_mounts(json.dumps(blob))
        self.assertEqual(mounts, ["/mnt/models"])
        p = Path(self.tmp.name) / "pods.json"
        p.write_text(json.dumps(blob), encoding="utf-8")
        self.assertEqual(load_hostpath_mounts(str(p)), ["/mnt/models"])
        self.assertEqual(load_hostpath_mounts("not-json"), [])

    def test_open_fd_promotes_safe_incomplete(self) -> None:
        path = str(Path(self.tmp.name) / "x.incomplete")
        Path(path).write_bytes(b"abc")
        row = classify_path(path, self.cat, size_bytes=3)
        self.assertEqual(row["risk"], "safe")
        out = apply_overlay([row], open_paths={os.path.realpath(path)})
        self.assertEqual(out[0]["risk"], "dangerous")
        self.assertEqual(out[0]["reclaim"], "none")
        self.assertEqual(out[0]["step"], "C")
        self.assertTrue(out[0]["in_use"])
        self.assertTrue(any("open file" in r for r in out[0]["in_use_reasons"]))

    def test_hf_pid_refuse_if(self) -> None:
        row = classify_path("/mnt/models/a.incomplete", self.cat, size_bytes=1)
        out = apply_overlay([row], hf_pid=True)
        self.assertEqual(out[0]["risk"], "dangerous")
        self.assertTrue(any("hf download" in r for r in out[0]["in_use_reasons"]))

    def test_hostpath_promotes(self) -> None:
        models = Path(self.tmp.name) / "models"
        models.mkdir()
        f = models / "weights.bin"
        f.write_bytes(b"w")
        row = classify_path(str(f), self.cat, size_bytes=1)
        out = apply_overlay([row], hostpath_mounts=[str(models)])
        self.assertTrue(out[0]["in_use"])
        self.assertEqual(out[0]["risk"], "dangerous")

    def test_running_image_promotes_crictl(self) -> None:
        row = {
            "id": "containerd-unused-image",
            "path": "crictl://unused-image/sha256:abc",
            "risk": "review",
            "reclaim": "docker-prune",
            "refuse_if": ["image_in_use"],
            "why": "old",
            "in_use": False,
            "in_use_reasons": [],
        }
        out = apply_overlay([row], running_images={"sha256:abc"})
        self.assertEqual(out[0]["risk"], "dangerous")

    def test_mode_c_and_visual_and_flash(self) -> None:
        engram = classify_path(str(Path(self.tmp.name) / "dsv41-engram" / "t"), self.cat, size_bytes=1)
        out = apply_overlay([engram], mode_c_running=True)
        self.assertTrue(out[0]["in_use"])
        media = {
            "id": "comfy-outputs-media",
            "path": "/mnt/models/out.mp4",
            "risk": "review",
            "reclaim": "none",
            "why": "media",
            "in_use": False,
            "in_use_reasons": [],
        }
        out2 = apply_overlay([media], visual_running=True)
        self.assertTrue(out2[0]["in_use"])
        ple = {
            "id": "ple-mmap",
            "path": "/mnt/models/flashnext-ple",
            "risk": "review",
            "reclaim": "quarantine",
            "why": "ple",
            "in_use": False,
            "in_use_reasons": [],
        }
        out3 = apply_overlay([ple], flash_next_running=True)
        self.assertTrue(out3[0]["in_use"])

    def test_noatime_does_not_use_atime(self) -> None:
        # Overlay must not inspect atime; recency is documented as unreliable.
        src = Path(self.tmp.name) / "old.incomplete"
        src.write_bytes(b"x")
        row = classify_path(str(src), self.cat, size_bytes=1)
        out = apply_overlay([row], open_paths=set(), hf_pid=False)
        self.assertEqual(out[0]["risk"], "safe")
        self.assertFalse(out[0]["in_use"])

    def test_hf_proc_scan_from_fake_proc(self) -> None:
        proc = Path(self.tmp.name) / "proc"
        pid = proc / "4242"
        pid.mkdir(parents=True)
        (pid / "comm").write_text("hf\n", encoding="utf-8")
        (pid / "cmdline").write_bytes(b"hf\x00download\x00")
        self.assertTrue(_hf_proc_running(str(proc)))
        other = Path(self.tmp.name) / "proc-empty"
        (other / "1").mkdir(parents=True)
        (other / "1" / "comm").write_text("bash\n", encoding="utf-8")
        self.assertFalse(_hf_proc_running(str(other)))
        self.assertFalse(
            hf_pid_present(
                env={"LAB_HERMETIC": "1", "LAB_MOCK_HF_PID": "0", "MODELS_DIR": self.tmp.name}
            )
        )
        self.assertTrue(
            hf_pid_present(
                env={"LAB_HERMETIC": "0", "MODELS_DIR": self.tmp.name},
                proc_root=str(proc),
            )
        )


if __name__ == "__main__":
    unittest.main()
