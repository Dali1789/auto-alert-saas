#!/usr/bin/env node

/**
 * Railway Auto-Deploy für Auto-Alert SaaS
 * Automatisches Service-Deployment mit Environment Variables
 */

const { spawn, exec } = require('child_process');
const path = require('path');

// Set Railway API Token
process.env.RAILWAY_TOKEN = 'fbe36775-4296-484e-bd0f-72aa378e01e6';

console.log('🚂 Railway Auto-Deploy für Auto-Alert SaaS');
console.log('=' .repeat(50));

async function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`🔄 Executing: ${command} ${args.join(' ')}`);
        
        const process = spawn(command, args, {
            cwd: 'D:\\Claude\\Projects\\auto-alert-saas',
            env: { ...process.env },
            stdio: ['inherit', 'pipe', 'pipe'],
            ...options
        });
        
        let stdout = '';
        let stderr = '';
        
        if (process.stdout) {
            process.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                console.log(output.trim());
            });
        }
        
        if (process.stderr) {
            process.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                console.error(output.trim());
            });
        }
        
        process.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Command completed successfully`);
                resolve(stdout);
            } else {
                console.log(`❌ Command failed with code ${code}`);
                reject(new Error(`Command failed: ${stderr}`));
            }
        });
        
        process.on('error', (error) => {
            console.log(`💥 Command error: ${error.message}`);
            reject(error);
        });
    });
}

async function setEnvironmentVariables() {
    console.log('\n🔑 Setting Environment Variables...');
    
    const envVars = {
        'NODE_ENV': 'production',
        'PORT': '3001',
        'WEBHOOK_SECRET': 'auto-alert-webhook-secret-2024'
    };
    
    for (const [key, value] of Object.entries(envVars)) {
        try {
            console.log(`Setting ${key}=${value}`);
            await runCommand('railway', ['variables', '--set', `${key}=${value}`]);
            
            // Small delay between commands
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.log(`⚠️  Failed to set ${key}: ${error.message}`);
        }
    }
}

async function deployService() {
    console.log('\n🚀 Starting Deployment...');
    
    try {
        // Try to deploy
        await runCommand('railway', ['up', '--detach']);
        console.log('\n✅ Deployment initiated successfully!');
        console.log('🔍 Check status: railway logs');
        console.log('🌐 Dashboard: https://railway.app/dashboard');
        return true;
    } catch (error) {
        console.log(`❌ Deployment failed: ${error.message}`);
        return false;
    }
}

async function main() {
    try {
        // 1. Check current status
        console.log('\n📊 1. Checking Railway Status...');
        await runCommand('railway', ['status']);
        
        // 2. Set environment variables
        await setEnvironmentVariables();
        
        // 3. Deploy
        const success = await deployService();
        
        if (success) {
            console.log('\n🎉 Railway Auto-Deploy Complete!');
        } else {
            console.log('\n⚠️  Deployment had issues - check Railway CLI manually');
        }
        
    } catch (error) {
        console.error(`💥 Main process error: ${error.message}`);
        process.exit(1);
    }
}

// Run main process
main().catch(console.error);