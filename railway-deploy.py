#!/usr/bin/env python3
"""
Railway Auto-Deploy Script
Automatisches Deployment des Auto-Alert SaaS Services
"""

import subprocess
import sys
import os
import time

def run_command(cmd, timeout=30):
    """Execute Railway command with timeout"""
    try:
        print(f"🔄 Executing: {cmd}")
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True, 
            timeout=timeout,
            cwd="D:\\Claude\\Projects\\auto-alert-saas"
        )
        
        if result.returncode == 0:
            print(f"✅ Success: {result.stdout}")
            return result.stdout
        else:
            print(f"❌ Error: {result.stderr}")
            return None
    except subprocess.TimeoutExpired:
        print(f"⏰ Timeout after {timeout}s")
        return None
    except Exception as e:
        print(f"💥 Exception: {e}")
        return None

def main():
    """Main deployment process"""
    print("🚂 Railway Auto-Deploy für Auto-Alert SaaS")
    print("=" * 50)
    
    # Set API Token
    os.environ["RAILWAY_TOKEN"] = "fbe36775-4296-484e-bd0f-72aa378e01e6"
    
    # 1. Check status
    print("\n📊 1. Checking Railway Status...")
    status = run_command("railway status")
    
    # 2. Set Environment Variables (via file approach)
    print("\n🔑 2. Setting Environment Variables...")
    
    env_vars = {
        "NODE_ENV": "production",
        "PORT": "3001", 
        "WEBHOOK_SECRET": "auto-alert-webhook-secret-2024"
    }
    
    for key, value in env_vars.items():
        cmd = f'railway variables --set "{key}={value}"'
        run_command(cmd, timeout=10)
        time.sleep(1)
    
    # 3. Deploy
    print("\n🚀 3. Starting Deployment...")
    deploy = run_command("railway up --detach", timeout=120)
    
    if deploy:
        print("\n✅ Deployment initiated successfully!")
        print("🔍 Check status with: railway logs")
        print("🌐 Open dashboard: https://railway.app/dashboard")
    else:
        print("\n❌ Deployment failed - check Railway CLI manually")
        
    print("\n🎉 Railway Auto-Deploy Complete!")

if __name__ == "__main__":
    main()