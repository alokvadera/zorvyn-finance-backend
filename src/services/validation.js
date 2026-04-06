const z = require('zod');

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['viewer', 'analyst', 'admin']),
});

const statusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

const recordSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Category is required'),
  record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  notes: z.string().optional(),
});

const querySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

module.exports = { loginSchema, registerSchema, statusSchema, recordSchema, querySchema };
