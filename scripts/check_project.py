from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]

required_files = [
    "package.json",
    "app/page.tsx",
    "app/layout.tsx",
    "app/globals.css",
    "app/login/page.tsx",
    "app/register/page.tsx",
    "app/investor/dashboard/page.tsx",
    "app/investor/marketplace/page.tsx",
    "app/investor/wallet/page.tsx",
    "app/investor/recovery/page.tsx",
    "app/farmer/dashboard/page.tsx",
    "app/admin/dashboard/page.tsx",
    "app/lib/supabase/client.ts",
    "app/lib/business/rules.ts",
    "vercel.json",
    ".env.example",
]

recommended_files = [
    "public/agarwood.png",
    "public/forest-bg.jpg",
    "public/sur-logo.png",
    "public/sur-plantation.mp4",
    "public/plantation-poster.jpg",
    "supabase/README.md",
]

required_scripts = ["dev", "build", "start", "lint"]

def exists(relative: str) -> bool:
    return (ROOT / relative).exists()

def main() -> int:
    failures = []
    warnings = []

    for file_name in required_files:
        if not exists(file_name):
            failures.append(f"Missing required file: {file_name}")

    for file_name in recommended_files:
        if not exists(file_name):
            warnings.append(f"Recommended asset/doc missing: {file_name}")

    package_path = ROOT / "package.json"
    if package_path.exists():
        package = json.loads(package_path.read_text(encoding="utf-8"))
        scripts = package.get("scripts", {})
        for script in required_scripts:
            if script not in scripts:
                failures.append(f"Missing npm script: {script}")

    print("SUR Aloeswood project check")
    print("===========================")

    if warnings:
        print("\nWarnings:")
        for warning in warnings:
            print(f"- {warning}")

    if failures:
        print("\nFailures:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("\nRequired project files and npm scripts are present.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
