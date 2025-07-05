"use client";
import React, { useState } from 'react';
import { useContract } from '../hooks/useContract';

interface CreateCampaignProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCampaign({ onClose, onSuccess }: CreateCampaignProps) {
  const { createCampaign, isLoading, error } = useContract();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goalAmount: '',
    duration: '30', // days
    category: 'Technology'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.goalAmount || !formData.duration) {
      alert('Please fill in all fields');
      return;
    }

    const goalNum = parseFloat(formData.goalAmount);
    if (isNaN(goalNum) || goalNum <= 0) {
      alert('Please enter a valid goal amount');
      return;
    }

    const durationNum = parseInt(formData.duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      alert('Please enter a valid duration in days');
      return;
    }

    setIsSubmitting(true);
    try {
      const durationInSeconds = durationNum * 24 * 60 * 60; // Convert days to seconds
      const txHash = await createCampaign(
        formData.title,
        formData.description,
        formData.goalAmount,
        durationInSeconds,
        formData.category
      );
      
      console.log('Campaign created successfully:', txHash);
      alert('Campaign created successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create campaign. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Create Campaign</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-900 text-red-100 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Campaign title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe your campaign"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Goal Amount (USDC)
            </label>
            <input
              type="number"
              name="goalAmount"
              value={formData.goalAmount}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1000"
              min="1"
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Duration (days)
            </label>
            <input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="30"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Technology">Technology</option>
              <option value="Environment">Environment</option>
              <option value="Education">Education</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Arts">Arts</option>
              <option value="Social">Social</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 