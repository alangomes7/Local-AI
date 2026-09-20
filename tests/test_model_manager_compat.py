from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from server.models import ModelManager


class TestModelManagerCompatibility(unittest.TestCase):
    def test_get_gen_models_accepts_instance_cache_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_dir = Path(tmpdir)
            model_dir = cache_dir / "models--org--demo-model"
            model_dir.mkdir(parents=True)
            (model_dir / "config.json").write_text(
                json.dumps({"_name_or_path": "org/demo-model"}),
                encoding="utf-8",
            )

            class DummyManager:
                def __init__(self, cache_dir: str):
                    self.cache_dir = cache_dir

            dummy = DummyManager(str(cache_dir))
            models = ModelManager.get_gen_models(dummy)

            self.assertEqual(models[0]["id"], "org/demo-model")

    def test_get_gen_models_accepts_direct_cache_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_dir = Path(tmpdir)
            model_dir = cache_dir / "models--org--demo-model"
            model_dir.mkdir(parents=True)
            (model_dir / "config.json").write_text(
                json.dumps({"_name_or_path": "org/demo-model"}),
                encoding="utf-8",
            )

            models = ModelManager.get_gen_models(str(cache_dir))

            self.assertEqual(models[0]["id"], "org/demo-model")

    def test_get_gen_models_uses_default_hf_home(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            hf_home = Path(tmpdir)
            cache_dir = hf_home / "hub"
            model_dir = cache_dir / "models--org--demo-model"
            model_dir.mkdir(parents=True)
            (model_dir / "config.json").write_text(
                json.dumps({"_name_or_path": "org/demo-model"}),
                encoding="utf-8",
            )

            old = os.environ.get("HF_HOME")
            os.environ["HF_HOME"] = str(hf_home)
            try:
                models = ModelManager.get_gen_models()
            finally:
                if old is None:
                    os.environ.pop("HF_HOME", None)
                else:
                    os.environ["HF_HOME"] = old

            self.assertEqual(models[0]["id"], "org/demo-model")


if __name__ == "__main__":
    unittest.main()
