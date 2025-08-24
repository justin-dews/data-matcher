'use client'

import { useState } from 'react'
import { UserIcon, BellIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SettingsSection from './SettingsSection'
import type { Database } from '@/lib/supabase'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

interface UserPreferencesProps {
  profile: ProfileRow
  settings: {
    notifications_enabled: boolean
    email_notifications: boolean
    theme: 'light' | 'dark' | 'system'
    language: string
  }
  onSave: (key: string, value: any) => Promise<void>
  onSaveMultiple: (settings: Record<string, any>) => Promise<void>
  loading: boolean
}

export default function UserPreferences({
  profile,
  settings,
  onSave,
  onSaveMultiple,
  loading
}: UserPreferencesProps) {
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    email: profile.email,
    notifications_enabled: settings.notifications_enabled,
    email_notifications: settings.email_notifications,
    theme: settings.theme,
    language: settings.language,
    notification_types: {
      matchFound: true,
      documentProcessed: true,
      weeklyReport: false,
      systemUpdates: true,
    }
  })

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev] as Record<string, any>,
          [child]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleSaveProfile = async () => {
    // This would need to be implemented to update the profiles table
    // For now, we'll just save the preference settings
    const { full_name, email, ...preferences } = formData
    await onSaveMultiple(preferences)
  }

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' },
  ]

  const hasChanges = JSON.stringify({
    notifications_enabled: settings.notifications_enabled,
    email_notifications: settings.email_notifications,
    theme: settings.theme,
    language: settings.language,
  }) !== JSON.stringify({
    notifications_enabled: formData.notifications_enabled,
    email_notifications: formData.email_notifications,
    theme: formData.theme,
    language: formData.language,
  })

  return (
    <SettingsSection
      title="User Preferences"
      description="Customize your personal settings and notification preferences"
    >
      {/* Profile Information */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <UserIcon className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-900">Profile Information</h4>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Your full name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Contact support to change your email address
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <input
              type="text"
              value={profile.role}
              disabled
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm sm:text-sm capitalize"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Member Since
            </label>
            <input
              type="text"
              value={new Date(profile.created_at).toLocaleDateString()}
              disabled
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Display Preferences */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <GlobeAltIcon className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-900">Display Preferences</h4>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Theme
            </label>
            <select
              value={formData.theme}
              onChange={(e) => handleInputChange('theme', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="system">System (Auto)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Language
            </label>
            <select
              value={formData.language}
              onChange={(e) => handleInputChange('language', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <BellIcon className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-900">Notification Preferences</h4>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">
                Enable Notifications
              </label>
              <p className="text-xs text-gray-500">
                Receive in-app notifications for important events
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.notifications_enabled}
                onChange={(e) => handleInputChange('notifications_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">
                Email Notifications
              </label>
              <p className="text-xs text-gray-500">
                Receive email updates for important events
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.email_notifications}
                onChange={(e) => handleInputChange('email_notifications', e.target.checked)}
                disabled={!formData.notifications_enabled}
                className="sr-only peer"
              />
              <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${!formData.notifications_enabled ? 'opacity-50' : ''}`}></div>
            </label>
          </div>
        </div>

        {/* Specific Notification Types */}
        {formData.notifications_enabled && (
          <div className="border-l-2 border-gray-200 pl-4 space-y-3">
            <h5 className="text-sm font-medium text-gray-700">Notification Types</h5>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm text-gray-700">New Matches Found</label>
                  <p className="text-xs text-gray-500">When new potential matches are identified</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notification_types.matchFound}
                    onChange={(e) => handleInputChange('notification_types.matchFound', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm text-gray-700">Document Processed</label>
                  <p className="text-xs text-gray-500">When document parsing is complete</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notification_types.documentProcessed}
                    onChange={(e) => handleInputChange('notification_types.documentProcessed', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm text-gray-700">Weekly Reports</label>
                  <p className="text-xs text-gray-500">Weekly summary of matching activity</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notification_types.weeklyReport}
                    onChange={(e) => handleInputChange('notification_types.weeklyReport', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm text-gray-700">System Updates</label>
                  <p className="text-xs text-gray-500">Important system announcements</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notification_types.systemUpdates}
                    onChange={(e) => handleInputChange('notification_types.systemUpdates', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Changes */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading && <LoadingSpinner size="sm" className="mr-2" />}
            Save Preferences
          </button>
        </div>
      )}
    </SettingsSection>
  )
}