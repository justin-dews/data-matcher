import Link from 'next/link'
import { DocumentPlusIcon, ClipboardDocumentCheckIcon, CogIcon } from '@heroicons/react/24/outline'

const actions = [
  {
    name: 'Upload Document',
    description: 'Upload a new PDF for parsing and matching',
    href: '/dashboard/upload',
    icon: DocumentPlusIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    name: 'Review Matches',
    description: 'Review and approve pending matches',
    href: '/dashboard/matches?status=pending',
    icon: ClipboardDocumentCheckIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    name: 'Manage Products',
    description: 'Add or update your product catalog',
    href: '/dashboard/catalog',
    icon: CogIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
]

export default function QuickActions() {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="space-y-4">
          {actions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className={`p-2 rounded-md ${action.bgColor}`}>
                <action.icon className={`h-5 w-5 ${action.color}`} />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-900">
                  {action.name}
                </div>
                <div className="text-sm text-gray-500">
                  {action.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}