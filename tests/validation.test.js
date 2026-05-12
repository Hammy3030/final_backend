import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  teacherQuestionBodySchema,
  studentTestSubmitSchema,
  studentGameSubmitSchema,
  announcementSchema,
  assignStudentsSchema,
  lessonReorderSchema,
  emptyBodySchema
} from '../middleware/validation.js';

describe('loginSchema', () => {
  it('accepts student code and empty password', () => {
    const { error } = loginSchema.validate({ email: 'STU001', password: '' });
    expect(error).toBeUndefined();
  });

  it('rejects invalid student code pattern', () => {
    const { error } = loginSchema.validate({ email: 'BAD', password: '' });
    expect(error).toBeDefined();
  });

  it('requires password for email login', () => {
    const { error } = loginSchema.validate({ email: 'a@b.com' });
    expect(error).toBeDefined();
  });
});

describe('registerSchema', () => {
  it('requires studentCode for STUDENT', () => {
    const { error } = registerSchema.validate({
      email: 's@x.com',
      password: 'secret12',
      role: 'STUDENT',
      name: 'ทดสอบ'
    });
    expect(error).toBeDefined();
  });
});

describe('teacherQuestionBodySchema', () => {
  it('accepts standard MCQ', () => {
    const { error } = teacherQuestionBodySchema.validate({
      question: '1+1=?',
      options: ['1', '2', '3'],
      correctAnswer: 1
    });
    expect(error).toBeUndefined();
  });

  it('accepts matching question', () => {
    const { error } = teacherQuestionBodySchema.validate({
      question: 'จับคู่',
      isMatching: true,
      matchingPairs: [{ left: 'ก', right: 'ไก่' }]
    });
    expect(error).toBeUndefined();
  });

  it('rejects matching without pairs', () => {
    const { error } = teacherQuestionBodySchema.validate({
      question: 'จับคู่',
      isMatching: true
    });
    expect(error).toBeDefined();
  });
});

describe('studentTestSubmitSchema', () => {
  it('requires answers object', () => {
    const { error } = studentTestSubmitSchema.validate({
      answers: { q1: 0 },
      timeSpent: 120
    });
    expect(error).toBeUndefined();
  });

  it('rejects missing answers', () => {
    const { error } = studentTestSubmitSchema.validate({ timeSpent: 1 });
    expect(error).toBeDefined();
  });
});

describe('studentGameSubmitSchema', () => {
  it('requires score', () => {
    const { error } = studentGameSubmitSchema.validate({ score: 10 });
    expect(error).toBeUndefined();
  });

  it('rejects without score', () => {
    const { error } = studentGameSubmitSchema.validate({});
    expect(error).toBeDefined();
  });
});

describe('announcementSchema', () => {
  it('requires title and content', () => {
    expect(announcementSchema.validate({ title: 'Hi', content: 'Body' }).error).toBeUndefined();
    expect(announcementSchema.validate({ title: '', content: 'x' }).error).toBeDefined();
  });
});

describe('assignStudentsSchema', () => {
  it('requires non-empty studentIds', () => {
    expect(assignStudentsSchema.validate({ studentIds: ['a'] }).error).toBeUndefined();
    expect(assignStudentsSchema.validate({ studentIds: [] }).error).toBeDefined();
  });
});

describe('lessonReorderSchema', () => {
  it('accepts lessonOrders array', () => {
    const { error } = lessonReorderSchema.validate({
      lessonOrders: [{ lessonId: '507f1f77bcf86cd799439011', orderIndex: 0 }]
    });
    expect(error).toBeUndefined();
  });
});

describe('emptyBodySchema', () => {
  it('allows empty object only', () => {
    expect(emptyBodySchema.validate({}).error).toBeUndefined();
    expect(emptyBodySchema.validate({ x: 1 }).error).toBeDefined();
  });
});
