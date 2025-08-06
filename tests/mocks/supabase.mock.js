/**
 * Supabase Client Mock for London School TDD
 * Provides consistent mock interface for Supabase operations
 */

class SupabaseMock {
  constructor() {
    this.mockData = new Map();
    this.interactions = [];
  }

  // Mock data setup
  setMockData(table, data) {
    this.mockData.set(table, Array.isArray(data) ? data : [data]);
  }

  // Table mock factory
  from(tableName) {
    return new SupabaseTableMock(tableName, this);
  }

  // Track interactions for verification
  recordInteraction(operation, table, data) {
    this.interactions.push({
      operation,
      table,
      data,
      timestamp: new Date()
    });
  }

  // Verification methods
  getInteractions(table = null) {
    return table 
      ? this.interactions.filter(i => i.table === table)
      : this.interactions;
  }

  wasTableAccessed(table) {
    return this.interactions.some(i => i.table === table);
  }

  wasOperationPerformed(operation, table = null) {
    return this.interactions.some(i => 
      i.operation === operation && (table ? i.table === table : true)
    );
  }

  reset() {
    this.mockData.clear();
    this.interactions = [];
  }
}

class SupabaseTableMock {
  constructor(tableName, client) {
    this.tableName = tableName;
    this.client = client;
    this.queryOptions = {};
  }

  select(columns = '*') {
    this.queryOptions.select = columns;
    return this;
  }

  insert(data) {
    this.client.recordInteraction('insert', this.tableName, data);
    
    const mockResult = Array.isArray(data) ? data : [data];
    
    return {
      select: () => ({
        single: () => ({
          data: mockResult[0],
          error: null
        }),
        then: (callback) => callback({
          data: mockResult,
          error: null
        })
      }),
      single: () => ({
        data: mockResult[0],
        error: null
      }),
      then: (callback) => callback({
        data: mockResult,
        error: null
      })
    };
  }

  update(data) {
    this.client.recordInteraction('update', this.tableName, data);
    return this;
  }

  delete() {
    this.client.recordInteraction('delete', this.tableName, null);
    return this;
  }

  eq(column, value) {
    this.queryOptions.eq = { column, value };
    return this;
  }

  neq(column, value) {
    this.queryOptions.neq = { column, value };
    return this;
  }

  gt(column, value) {
    this.queryOptions.gt = { column, value };
    return this;
  }

  gte(column, value) {
    this.queryOptions.gte = { column, value };
    return this;
  }

  lt(column, value) {
    this.queryOptions.lt = { column, value };
    return this;
  }

  lte(column, value) {
    this.queryOptions.lte = { column, value };
    return this;
  }

  like(column, pattern) {
    this.queryOptions.like = { column, pattern };
    return this;
  }

  in(column, values) {
    this.queryOptions.in = { column, values };
    return this;
  }

  is(column, value) {
    this.queryOptions.is = { column, value };
    return this;
  }

  order(column, options = {}) {
    this.queryOptions.order = { column, ...options };
    return this;
  }

  limit(count) {
    this.queryOptions.limit = count;
    return this;
  }

  range(from, to) {
    this.queryOptions.range = { from, to };
    return this;
  }

  single() {
    const mockData = this.client.mockData.get(this.tableName) || [];
    const filteredData = this.applyFilters(mockData);
    
    this.client.recordInteraction('select', this.tableName, this.queryOptions);
    
    return {
      data: filteredData[0] || null,
      error: filteredData.length === 0 ? new Error('No rows found') : null
    };
  }

  then(callback) {
    const mockData = this.client.mockData.get(this.tableName) || [];
    const filteredData = this.applyFilters(mockData);
    
    this.client.recordInteraction('select', this.tableName, this.queryOptions);
    
    return callback({
      data: filteredData,
      error: null,
      count: filteredData.length
    });
  }

  // Apply query filters to mock data
  applyFilters(data) {
    let filtered = [...data];

    // Apply eq filter
    if (this.queryOptions.eq) {
      const { column, value } = this.queryOptions.eq;
      filtered = filtered.filter(item => item[column] === value);
    }

    // Apply neq filter
    if (this.queryOptions.neq) {
      const { column, value } = this.queryOptions.neq;
      filtered = filtered.filter(item => item[column] !== value);
    }

    // Apply gt filter
    if (this.queryOptions.gt) {
      const { column, value } = this.queryOptions.gt;
      filtered = filtered.filter(item => item[column] > value);
    }

    // Apply gte filter
    if (this.queryOptions.gte) {
      const { column, value } = this.queryOptions.gte;
      filtered = filtered.filter(item => item[column] >= value);
    }

    // Apply lt filter
    if (this.queryOptions.lt) {
      const { column, value } = this.queryOptions.lt;
      filtered = filtered.filter(item => item[column] < value);
    }

    // Apply lte filter
    if (this.queryOptions.lte) {
      const { column, value } = this.queryOptions.lte;
      filtered = filtered.filter(item => item[column] <= value);
    }

    // Apply like filter
    if (this.queryOptions.like) {
      const { column, pattern } = this.queryOptions.like;
      const regexPattern = pattern.replace(/%/g, '.*');
      const regex = new RegExp(regexPattern, 'i');
      filtered = filtered.filter(item => regex.test(item[column]));
    }

    // Apply in filter
    if (this.queryOptions.in) {
      const { column, values } = this.queryOptions.in;
      filtered = filtered.filter(item => values.includes(item[column]));
    }

    // Apply is filter
    if (this.queryOptions.is) {
      const { column, value } = this.queryOptions.is;
      if (value === null) {
        filtered = filtered.filter(item => item[column] == null);
      } else {
        filtered = filtered.filter(item => item[column] === value);
      }
    }

    // Apply order
    if (this.queryOptions.order) {
      const { column, ascending = true } = this.queryOptions.order;
      filtered.sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
        
        if (aVal < bVal) return ascending ? -1 : 1;
        if (aVal > bVal) return ascending ? 1 : -1;
        return 0;
      });
    }

    // Apply limit
    if (this.queryOptions.limit) {
      filtered = filtered.slice(0, this.queryOptions.limit);
    }

    // Apply range
    if (this.queryOptions.range) {
      const { from, to } = this.queryOptions.range;
      filtered = filtered.slice(from, to + 1);
    }

    return filtered;
  }
}

// Factory function for creating Supabase mocks
const createSupabaseMock = () => {
  return new SupabaseMock();
};

// Mock response builders
const mockSupabaseResponse = (data, error = null) => ({
  data,
  error,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK'
});

const mockSupabaseError = (message, details = {}) => ({
  message,
  details,
  hint: null,
  code: '42P01'
});

// Behavior verification matchers
const toHaveBeenCalledWithTable = (received, tableName) => {
  const interactions = received.getInteractions(tableName);
  const pass = interactions.length > 0;
  
  return {
    message: () => 
      `expected Supabase mock ${pass ? 'not ' : ''}to have been called with table "${tableName}"`,
    pass
  };
};

const toHavePerformedOperation = (received, operation, tableName) => {
  const pass = received.wasOperationPerformed(operation, tableName);
  
  return {
    message: () => 
      `expected Supabase mock ${pass ? 'not ' : ''}to have performed "${operation}" on table "${tableName}"`,
    pass
  };
};

// Extend Jest matchers
if (typeof expect !== 'undefined') {
  expect.extend({
    toHaveBeenCalledWithTable,
    toHavePerformedOperation
  });
}

module.exports = {
  SupabaseMock,
  SupabaseTableMock,
  createSupabaseMock,
  mockSupabaseResponse,
  mockSupabaseError
};