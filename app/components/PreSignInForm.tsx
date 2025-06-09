'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FaLock, FaUser } from 'react-icons/fa';

interface PreSignInFormProps {
  onSubmit: (data: {
    name: string;
    email: string;
    organization: string;
    purpose: string;
  }) => void;
  onCancel: () => void;
  initialEmail?: string;
}

export default function PreSignInForm({ onSubmit, onCancel, initialEmail = '' }: PreSignInFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: initialEmail,
    organization: '',
    purpose: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-5">
        <div className="inline-flex justify-center items-center h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-3">
          <FaUser className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tell us about yourself</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          We'd like to know a bit about you before you continue
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your name"
              required
            />
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your email"
              required
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Organization
            </label>
            <input
              type="text"
              value={formData.organization}
              onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Company or organization"
            />
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primary Interest
            </label>
            <select
              value={formData.purpose}
              onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white appearance-none bg-white dark:bg-gray-700"
            >
              <option value="">Select your interest</option>
              <option value="Code Exploration">Code Exploration</option>
              <option value="Project Research">Project Research</option>
              <option value="Learning">Learning</option>
              <option value="Work">Work</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        
        {formData.purpose === 'Other' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Please specify
            </label>
            <input
              type="text"
              value={formData.purpose === 'Other' ? formData.purpose : ''}
              onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Tell us more about your interest"
            />
          </div>
        )}
        
        {/* Privacy notice */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 mb-4 text-center">
          <div className="flex items-center justify-center">
            <FaLock className="h-3 w-3 text-gray-400 mr-1.5 flex-shrink-0 translate-y-[0.5px]" />
            <span>
              By continuing, you agree to our{' '}
              <Link 
                href="/privacy" 
                className="text-blue-600 dark:text-blue-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
              >
                privacy policy
              </Link>
            </span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[100px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors min-w-[100px]"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
} 