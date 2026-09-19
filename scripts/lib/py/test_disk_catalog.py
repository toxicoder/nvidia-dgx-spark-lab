#!/usr/bin/env python3
"""Unit tests for disk_catalog (restricted YAML, classify, rank, recommend, jail)."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from disk_catalog import (
    classify_path,
    dir_size_bytes,
    is_factory_bittest_path,
    is_keep_set,
    is_protected_path,
    largest_entries,
    load_catalog,
    normalize_runtime_type,
    path_under_roots,
    pressure_for,
    rank_candidates,
    rank_score,
    recency_hint,
    recommend_rows,
    same_fs,
    shallow_paths,
    step_totals,
    walk_root_files,
    _cli,
)

MINI = """
schema: 1
keep_set:
  prefixes:
    - keepme
    - dsv41-engram
  basenames:
    - vital.bin
signatures:
  hf-incomplete:
    risk: safe
    reclaim: delete
    leftover_weight: 10
    what: "Interrupted download"
    why: "ctrl-c"
    leftover_when: ".incomplete"
    educate: "safe junk"
    match_suffix:
      - ".incomplete"
    refuse_if:
      - hf_pid
  pip-uv-cache:
    risk: safe
    reclaim: delete
    leftover_weight: 3
    what: "pip cache"
    why: "wheels"
    leftover_when: "pip"
    match_contains:
      - "/.cache/pip"
  keep-set-weight:
    risk: dangerous
    reclaim: none
    leftover_weight: 0
    what: "keep-set"
    why: "lab"
    leftover_when: "never"
    match_keep_set: true
  dangling-symlink:
    risk: safe
    reclaim: delete
    leftover_weight: 9
    what: "broken link"
    why: "moved"
    leftover_when: "dangling"
    match_broken_symlink: true
  extra-review:
    risk: review
    reclaim: quarantine
    leftover_weight: 5
    what: "review leftover"
    why: "experiment"
    leftover_when: "extra-review"
    match_contains:
      - "/extra-review/"
"""


class TestDiskCatalog(unittest.TestCase):
    """Catalog parse, classify, recommend, walk, jail."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cat_path = Path(self.tmp.name) / "catalog.yaml"
        self.cat_path.write_text(MINI, encoding="utf-8")
        self.cat = load_catalog(self.cat_path)

    def test_load_rejects_bad_risk(self) -> None:
        p = Path(self.tmp.name) / "bad.yaml"
        p.write_text("schema: 1\nsignatures:\n  x:\n    risk: nope\n    reclaim: none\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            load_catalog(p)

    def test_load_rejects_bad_reclaim(self) -> None:
        p = Path(self.tmp.name) / "bad2.yaml"
        p.write_text("schema: 1\nsignatures:\n  x:\n    risk: safe\n    reclaim: explode\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            load_catalog(p)

    def test_real_catalog_parses(self) -> None:
        repo = Path(__file__).resolve().parents[3]
        real = repo / "config" / "disk-catalog.yaml"
        cat = load_catalog(real)
        self.assertGreaterEqual(cat["schema"], 1)
        self.assertIn("hf-incomplete", cat["signatures"])
        self.assertIn("keep-set-weight", cat["signatures"])
        self.assertIn("dsv41-engram", cat["keep_prefixes"])
        self.assertEqual(cat["signatures"]["keep-set-weight"]["risk"], "dangerous")
        self.assertEqual(cat["signatures"]["keep-set-weight"]["reclaim"], "none")
        hub = classify_path(
            "/home/x/.cache/huggingface/hub/models--Someone--Experiment",
            cat,
            size_bytes=50,
        )
        self.assertEqual(hub["id"], "hf-complete-repo")
        self.assertEqual(hub["risk"], "review")

    def test_incomplete_is_safe_delete(self) -> None:
        row = classify_path("/mnt/models/foo.safetensors.incomplete", self.cat, size_bytes=100)
        self.assertEqual(row["id"], "hf-incomplete")
        self.assertEqual(row["risk"], "safe")
        self.assertEqual(row["reclaim"], "delete")
        self.assertEqual(row["step"], "A")

    def test_keep_set_is_dangerous(self) -> None:
        row = classify_path("/mnt/models/org__keepme/weights.bin", self.cat, size_bytes=50)
        self.assertEqual(row["id"], "keep-set-weight")
        self.assertEqual(row["risk"], "dangerous")
        self.assertEqual(row["reclaim"], "none")
        self.assertEqual(row["step"], "C")

    def test_incomplete_inside_keep_set_is_still_junk(self) -> None:
        self.assertFalse(is_keep_set("/mnt/models/keepme/x.incomplete", self.cat))
        row = classify_path("/mnt/models/keepme/x.incomplete", self.cat, size_bytes=9)
        self.assertEqual(row["id"], "hf-incomplete")

    def test_unknown_large_is_review_none(self) -> None:
        row = classify_path("/mnt/models/mystery.bin", self.cat, size_bytes=999)
        self.assertEqual(row["id"], "unknown-large")
        self.assertEqual(row["risk"], "review")
        self.assertEqual(row["reclaim"], "none")

    def test_rank_score_prefers_safe_large(self) -> None:
        self.assertGreater(rank_score(100, 10, "safe"), rank_score(100, 10, "review"))
        self.assertGreater(rank_score(100, 10, "review"), rank_score(100, 10, "dangerous"))

    def test_recommend_fills_safe_only_until_target(self) -> None:
        rows = [
            classify_path("/a/x.incomplete", self.cat, size_bytes=8),
            classify_path("/a/.cache/pip/w", self.cat, size_bytes=4),
            classify_path("/a/keepme/w.bin", self.cat, size_bytes=1000),
            classify_path("/a/mystery.bin", self.cat, size_bytes=50),
        ]
        rec = recommend_rows(rows, target_bytes=10, include_review=False)
        ids = [r["id"] for r in rec]
        self.assertIn("hf-incomplete", ids)
        self.assertNotIn("keep-set-weight", ids)
        self.assertTrue(all(r["risk"] == "safe" for r in rec))
        self.assertGreaterEqual(rec[-1]["running_bytes"], 8)

    def test_recommend_appends_review_when_short(self) -> None:
        rows = [
            classify_path("/a/x.incomplete", self.cat, size_bytes=1),
            classify_path("/a/extra-review/blob", self.cat, size_bytes=50),
        ]
        rec = recommend_rows(rows, target_bytes=40, include_review=True)
        self.assertTrue(any(r.get("needs_confirm") for r in rec))
        self.assertTrue(any(r["id"] == "extra-review" for r in rec))

    def test_recommend_skips_in_use(self) -> None:
        row = classify_path("/a/x.incomplete", self.cat, size_bytes=99)
        row["in_use"] = True
        rec = recommend_rows([row], target_bytes=1, include_review=True)
        self.assertEqual(rec, [])

    def test_path_under_roots_jail(self) -> None:
        root = os.path.realpath(self.tmp.name)
        inside = os.path.join(root, "models", "a.bin")
        os.makedirs(os.path.dirname(inside), exist_ok=True)
        Path(inside).write_bytes(b"x")
        self.assertTrue(path_under_roots(inside, [root]))
        self.assertFalse(path_under_roots("/etc/passwd", [root]))
        escaped = os.path.join(root, "models", "..", "..", "etc", "passwd")
        self.assertFalse(path_under_roots(escaped, [os.path.join(root, "models")]))
        self.assertFalse(path_under_roots("docker://img/x", [root]))

    def test_walk_prunes_quarantine_and_skips_dir_symlink(self) -> None:
        root = Path(self.tmp.name) / "tree"
        (root / "keep").mkdir(parents=True)
        (root / "keep" / "a.bin").write_bytes(b"abc")
        q = root / ".disk-quarantine" / "x"
        q.mkdir(parents=True)
        (q / "hidden.bin").write_bytes(b"nope")
        outside = Path(self.tmp.name) / "outside"
        outside.mkdir()
        (outside / "secret.bin").write_bytes(b"sshh")
        os.symlink(str(outside), str(root / "linkdir"))
        paths = [r["path"] for r in walk_root_files(str(root), max_depth=8)]
        self.assertTrue(any(p.endswith("a.bin") for p in paths))
        self.assertFalse(any("hidden.bin" in p for p in paths))
        self.assertFalse(any("secret.bin" in p for p in paths))

    def test_dangling_symlink_classifies(self) -> None:
        link = Path(self.tmp.name) / "gone.link"
        link.symlink_to("missing-target")
        row = classify_path(str(link), self.cat, size_bytes=0, broken_symlink=True)
        self.assertEqual(row["id"], "dangling-symlink")

    def test_pressure_thresholds(self) -> None:
        self.assertEqual(pressure_for(50, 500 * 1024**3), "ok")
        self.assertEqual(pressure_for(75, 500 * 1024**3), "warn")
        self.assertEqual(pressure_for(90, 500 * 1024**3), "crit")
        self.assertEqual(pressure_for(10, 40 * 1024**3), "crit")
        self.assertEqual(pressure_for(10, 100 * 1024**3), "warn")

    def test_rank_candidates_order(self) -> None:
        a = classify_path("/z.incomplete", self.cat, size_bytes=10)
        b = classify_path("/a.incomplete", self.cat, size_bytes=20)
        ordered = rank_candidates([a, b])
        self.assertEqual(ordered[0]["path"], "/a.incomplete")

    def test_shallow_and_largest(self) -> None:
        root = Path(self.tmp.name) / "models"
        root.mkdir()
        big = root / "big.bin"
        big.write_bytes(b"x" * 100)
        small = root / "small.bin"
        small.write_bytes(b"y")
        (root / "foo.incomplete").write_bytes(b"z" * 5)
        rows = list(shallow_paths([str(root)]))
        self.assertTrue(any(str(r["path"]).endswith("foo.incomplete") for r in rows))
        top = largest_entries(str(root), limit=5)
        self.assertGreaterEqual(len(top["files"]), 1)
        self.assertEqual(top["files"][0]["path"], str(big))
        self.assertGreater(dir_size_bytes(str(root)), 100)

    def test_cli_classify_and_json(self) -> None:
        rc = _cli(["--catalog", str(self.cat_path), "json"])
        self.assertEqual(rc, 0)
        rc = _cli(
            [
                "--catalog",
                str(self.cat_path),
                "classify",
                "--path",
                "/x.incomplete",
                "--size",
                "3",
            ]
        )
        self.assertEqual(rc, 0)

    def test_cli_rank_stdin(self) -> None:
        payload = json.dumps({"path": "/x.incomplete", "size_bytes": 4, "broken_symlink": False})
        import io
        from unittest.mock import patch

        with patch("sys.stdin", io.StringIO(payload + "\n")):
            rc = _cli(["--catalog", str(self.cat_path), "rank"])
        self.assertEqual(rc, 0)

    def test_recency_hint_uses_refs_mtime_not_atime(self) -> None:
        repo = Path(self.tmp.name) / "models--Org--Name"
        refs = repo / "refs"
        refs.mkdir(parents=True)
        pin = refs / "main"
        pin.write_text("abc", encoding="utf-8")
        old = 1_700_000_000.0
        os.utime(pin, (old, old))
        os.utime(refs, (old, old))
        hint = recency_hint(str(repo), now=old + 10 * 86400)
        self.assertIn("mtime", hint)
        self.assertIn("noatime", hint)
        self.assertIn("~10d", hint)
        self.assertEqual(recency_hint("docker://unused-image/x"), "")

    def test_protected_paths(self) -> None:
        models = Path(self.tmp.name) / "models"
        models.mkdir()
        repo = Path(self.tmp.name) / "repo"
        repo.mkdir()
        (repo / "secret.sh").write_text("x", encoding="utf-8")
        child = models / "junk.incomplete"
        child.write_text("j", encoding="utf-8")
        self.assertTrue(is_protected_path("/", models_dir=str(models), repo_root=str(repo)))
        self.assertTrue(is_protected_path("/etc/passwd", models_dir=str(models), repo_root=str(repo)))
        self.assertTrue(is_protected_path(str(models), models_dir=str(models), repo_root=str(repo)))
        self.assertTrue(is_protected_path(str(repo / "secret.sh"), models_dir=str(models), repo_root=str(repo)))
        self.assertFalse(is_protected_path(str(child), models_dir=str(models), repo_root=str(repo)))
        self.assertFalse(is_protected_path("crictl://unused-image/sha256:abc"))

    def test_normalize_runtime_type(self) -> None:
        self.assertEqual(normalize_runtime_type("Build Cache"), "build-cache")
        self.assertEqual(normalize_runtime_type("Local Volumes"), "local-volume")
        self.assertEqual(normalize_runtime_type("Images"), "unused-image")
        self.assertEqual(normalize_runtime_type("Containers"), "containers")
        self.assertEqual(normalize_runtime_type("in-use-image"), "in-use-image")

    def test_real_catalog_docker_volumes_are_dangerous(self) -> None:
        repo = Path(__file__).resolve().parents[3]
        cat = load_catalog(repo / "config" / "disk-catalog.yaml")
        vol = classify_path("docker://local-volume/comfy-state", cat, size_bytes=9)
        self.assertEqual(vol["id"], "docker-local-volume")
        self.assertEqual(vol["risk"], "dangerous")
        self.assertEqual(vol["reclaim"], "none")
        ctr = classify_path("docker://containers/abc", cat, size_bytes=1)
        self.assertEqual(ctr["risk"], "dangerous")
        img = classify_path("crictl://unused-image/sha256:abc", cat, size_bytes=40)
        self.assertEqual(img["id"], "containerd-unused-image")
        self.assertEqual(img["reclaim"], "docker-prune")
        bittest = classify_path("/~bittest-oem.txt", cat, size_bytes=10)
        self.assertEqual(bittest["id"], "factory-bittest")
        self.assertEqual(bittest["risk"], "review")

    def test_step_totals(self) -> None:
        rows = [
            classify_path("/a.incomplete", self.cat, size_bytes=10),
            classify_path("/a/extra-review/blob", self.cat, size_bytes=20),
            classify_path("/a/keepme/w.bin", self.cat, size_bytes=40),
        ]
        totals = step_totals(rows)
        self.assertEqual(totals["A"], 10)
        self.assertEqual(totals["B"], 20)
        self.assertEqual(totals["C"], 40)

    def test_same_fs_and_factory_bittest_path(self) -> None:
        a = Path(self.tmp.name) / "a"
        b = Path(self.tmp.name) / "b"
        a.write_text("x", encoding="utf-8")
        b.write_text("y", encoding="utf-8")
        self.assertTrue(same_fs(str(a), str(b)))
        base = Path(self.tmp.name)
        hit = base / "~bittest-foo.txt"
        hit.write_text("z", encoding="utf-8")
        nested = base / "sub" / "bittest.bin"
        nested.parent.mkdir()
        nested.write_text("n", encoding="utf-8")
        self.assertTrue(is_factory_bittest_path(str(hit), glob_base=str(base)))
        self.assertFalse(is_factory_bittest_path(str(nested), glob_base=str(base)))
        self.assertFalse(is_factory_bittest_path(str(a), glob_base=str(base)))

    def test_cli_shallow_walk_largest_recommend(self) -> None:
        root = Path(self.tmp.name) / "walk"
        root.mkdir()
        (root / "foo.incomplete").write_bytes(b"zz")
        rc = _cli(["--catalog", str(self.cat_path), "shallow", str(root)])
        self.assertEqual(rc, 0)
        rc = _cli(["--catalog", str(self.cat_path), "walk", "--max-depth", "2", str(root)])
        self.assertEqual(rc, 0)
        rc = _cli(
            ["--catalog", str(self.cat_path), "largest", "--path", str(root), "--n", "5"]
        )
        self.assertEqual(rc, 0)
        payload = json.dumps({"path": str(root / "foo.incomplete"), "size_bytes": 2})
        import io
        from unittest.mock import patch

        with patch("sys.stdin", io.StringIO(payload + "\n")):
            rc = _cli(["--catalog", str(self.cat_path), "recommend", "--target-gib", "1"])
        self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main()
