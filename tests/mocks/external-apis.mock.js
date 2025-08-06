/**
 * External API Mocks for London School TDD
 * Mocks for Retell AI, Resend, and other external services
 */

const { EventEmitter } = require('events');

// Axios Mock for HTTP requests
class AxiosMock {
  constructor() {
    this.requests = [];
    this.mockResponses = new Map();
    this.mockErrors = new Map();
  }

  // Configure mock responses
  setupMockResponse(url, method, response, status = 200) {
    const key = `${method.toUpperCase()}:${url}`;
    this.mockResponses.set(key, { 
      data: response, 
      status, 
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {}
    });
  }

  setupMockError(url, method, error) {
    const key = `${method.toUpperCase()}:${url}`;
    this.mockErrors.set(key, error);
  }

  // Mock HTTP methods
  async post(url, data, config = {}) {
    return this.makeRequest('POST', url, data, config);
  }

  async get(url, config = {}) {
    return this.makeRequest('GET', url, null, config);
  }

  async put(url, data, config = {}) {
    return this.makeRequest('PUT', url, data, config);
  }

  async delete(url, config = {}) {
    return this.makeRequest('DELETE', url, null, config);
  }

  async makeRequest(method, url, data, config) {
    const request = {
      method,
      url,
      data,
      config,
      timestamp: new Date()
    };
    
    this.requests.push(request);

    const key = `${method}:${url}`;
    
    // Check for configured error
    if (this.mockErrors.has(key)) {
      const error = this.mockErrors.get(key);
      throw new Error(error);
    }

    // Return configured response or default
    const response = this.mockResponses.get(key) || {
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {}
    };

    return response;
  }

  // Verification methods
  getRequests(method = null, url = null) {
    return this.requests.filter(req => {
      if (method && req.method !== method.toUpperCase()) return false;
      if (url && !req.url.includes(url)) return false;
      return true;
    });
  }

  wasRequestMade(method, url) {
    return this.getRequests(method, url).length > 0;
  }

  getLastRequest() {
    return this.requests[this.requests.length - 1];
  }

  reset() {
    this.requests = [];
    this.mockResponses.clear();
    this.mockErrors.clear();
  }
}

// Retell AI API Mock
class RetellAIMock {
  constructor() {
    this.calls = [];
    this.llms = [];
    this.callStatuses = new Map();
  }

  // Mock call creation
  async createCall(callData) {
    const call = {
      call_id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      call_status: 'queued',
      from_number: callData.fromNumber,
      to_number: callData.toNumber,
      agent_id: callData.overrideAgentId,
      created_at: new Date().toISOString()
    };

    this.calls.push(call);
    this.callStatuses.set(call.call_id, 'queued');

    return { data: call };
  }

  // Mock LLM creation
  async createLLM(llmData) {
    const llm = {
      llm_id: `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      model: llmData.model,
      general_prompt: llmData.general_prompt,
      begin_message: llmData.begin_message,
      created_at: new Date().toISOString()
    };

    this.llms.push(llm);
    return { data: llm };
  }

  // Simulate call status updates
  updateCallStatus(callId, status, endReason = null) {
    this.callStatuses.set(callId, status);
    return {
      call_id: callId,
      call_status: status,
      end_reason: endReason,
      updated_at: new Date().toISOString()
    };
  }

  // Verification methods
  getCall(callId) {
    return this.calls.find(call => call.call_id === callId);
  }

  getAllCalls() {
    return this.calls;
  }

  getLLM(llmId) {
    return this.llms.find(llm => llm.llm_id === llmId);
  }

  wasCallMade(toNumber = null) {
    if (!toNumber) return this.calls.length > 0;
    return this.calls.some(call => call.to_number === toNumber);
  }

  getCallsToNumber(toNumber) {
    return this.calls.filter(call => call.to_number === toNumber);
  }

  reset() {
    this.calls = [];
    this.llms = [];
    this.callStatuses.clear();
  }
}

// Resend Email Mock
class ResendMock {
  constructor() {
    this.emails = [];
  }

  // Mock email sending
  async send(emailData) {
    const email = {
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      created_at: new Date().toISOString(),
      status: 'sent'
    };

    this.emails.push(email);
    return { id: email.id };
  }

  // Verification methods
  getEmail(emailId) {
    return this.emails.find(email => email.id === emailId);
  }

  getEmailsTo(recipient) {
    return this.emails.filter(email => 
      Array.isArray(email.to) 
        ? email.to.includes(recipient)
        : email.to === recipient
    );
  }

  wasEmailSent(recipient = null) {
    if (!recipient) return this.emails.length > 0;
    return this.getEmailsTo(recipient).length > 0;
  }

  getLastEmail() {
    return this.emails[this.emails.length - 1];
  }

  reset() {
    this.emails = [];
  }
}

// File System Mock
class FileSystemMock extends EventEmitter {
  constructor() {
    super();
    this.files = new Map();
    this.directories = new Set();
    this.operations = [];
  }

  // Mock file operations
  async readFile(filePath) {
    this.recordOperation('readFile', filePath);
    
    if (!this.files.has(filePath)) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }
    
    return this.files.get(filePath);
  }

  async writeFile(filePath, data) {
    this.recordOperation('writeFile', filePath, data);
    this.files.set(filePath, data);
    this.emit('fileWritten', filePath, data);
  }

  async unlink(filePath) {
    this.recordOperation('unlink', filePath);
    
    if (!this.files.has(filePath)) {
      const error = new Error(`ENOENT: no such file or directory, unlink '${filePath}'`);
      error.code = 'ENOENT';
      throw error;
    }
    
    this.files.delete(filePath);
    this.emit('fileDeleted', filePath);
  }

  async mkdir(dirPath, options = {}) {
    this.recordOperation('mkdir', dirPath, options);
    this.directories.add(dirPath);
    
    if (options.recursive) {
      const parts = dirPath.split('/');
      let current = '';
      for (const part of parts) {
        current += part + '/';
        this.directories.add(current.slice(0, -1));
      }
    }
  }

  // Mock Sharp for image processing
  createSharpMock(buffer) {
    const mockSharp = {
      metadata: jest.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        space: 'srgb',
        channels: 3,
        depth: 'uchar'
      }),
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(buffer)
    };

    return mockSharp;
  }

  // Setup file mock
  setupFile(filePath, content) {
    this.files.set(filePath, content);
  }

  // Verification methods
  recordOperation(operation, path, data = null) {
    this.operations.push({
      operation,
      path,
      data,
      timestamp: new Date()
    });
  }

  wasFileAccessed(filePath) {
    return this.operations.some(op => op.path === filePath);
  }

  wasOperationPerformed(operation, filePath = null) {
    return this.operations.some(op => 
      op.operation === operation && (filePath ? op.path === filePath : true)
    );
  }

  getOperations(operation = null) {
    return operation 
      ? this.operations.filter(op => op.operation === operation)
      : this.operations;
  }

  reset() {
    this.files.clear();
    this.directories.clear();
    this.operations = [];
  }
}

// Redis Mock
class RedisMock {
  constructor() {
    this.data = new Map();
    this.commands = [];
    this.ttls = new Map();
  }

  // Mock Redis commands
  async get(key) {
    this.recordCommand('get', [key]);
    return this.data.get(key) || null;
  }

  async set(key, value) {
    this.recordCommand('set', [key, value]);
    this.data.set(key, value);
    return 'OK';
  }

  async setEx(key, ttl, value) {
    this.recordCommand('setEx', [key, ttl, value]);
    this.data.set(key, value);
    this.ttls.set(key, Date.now() + (ttl * 1000));
    return 'OK';
  }

  async del(key) {
    this.recordCommand('del', [key]);
    const existed = this.data.has(key);
    this.data.delete(key);
    this.ttls.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key) {
    this.recordCommand('exists', [key]);
    return this.data.has(key) ? 1 : 0;
  }

  async info() {
    this.recordCommand('info', []);
    return `# Memory
used_memory:1048576
# Stats
total_commands_processed:100
instantaneous_ops_per_sec:10
keyspace_hits:75
keyspace_misses:25
# Clients
connected_clients:5`;
  }

  // Mock command recording
  recordCommand(command, args) {
    this.commands.push({
      command,
      args,
      timestamp: new Date()
    });
  }

  // Verification methods
  wasCommandExecuted(command, key = null) {
    return this.commands.some(cmd => 
      cmd.command === command && (key ? cmd.args[0] === key : true)
    );
  }

  getCommands(command = null) {
    return command 
      ? this.commands.filter(cmd => cmd.command === command)
      : this.commands;
  }

  reset() {
    this.data.clear();
    this.commands = [];
    this.ttls.clear();
  }
}

// Factory functions
const createAxiosMock = () => new AxiosMock();
const createRetellAIMock = () => new RetellAIMock();
const createResendMock = () => new ResendMock();
const createFileSystemMock = () => new FileSystemMock();
const createRedisMock = () => new RedisMock();

module.exports = {
  AxiosMock,
  RetellAIMock,
  ResendMock,
  FileSystemMock,
  RedisMock,
  createAxiosMock,
  createRetellAIMock,
  createResendMock,
  createFileSystemMock,
  createRedisMock
};