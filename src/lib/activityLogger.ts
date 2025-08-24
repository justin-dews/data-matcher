import { supabase } from './supabase'

export interface ActivityLogParams {
  organizationId: string
  userId?: string
  action: string
  resourceType: string
  resourceId?: string
  metadata?: Record<string, any>
}

export type ActivityAction = 
  // Export actions
  | 'export_csv'
  | 'export_start' 
  | 'export_failed'
  | 'export_completed'
  
  // Match actions
  | 'match_approved'
  | 'match_rejected'
  | 'match_auto'
  | 'match_bulk_approved'
  | 'match_bulk_rejected'
  | 'match_manual_selected'
  
  // Document actions
  | 'document_uploaded'
  | 'document_parsed'
  | 'document_failed'
  | 'document_deleted'
  
  // Product actions
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'product_imported'
  
  // Bulk actions
  | 'bulk_action'
  | 'auto_match_run'
  
  // Settings actions
  | 'settings_updated'
  | 'threshold_changed'
  | 'user_invited'
  | 'user_removed'

export type ResourceType = 
  | 'export'
  | 'match'
  | 'document'
  | 'product'
  | 'line_item'
  | 'user'
  | 'organization'
  | 'settings'

/**
 * Centralized activity logging service
 */
export class ActivityLogger {
  /**
   * Log a single activity
   */
  static async log({
    organizationId,
    userId,
    action,
    resourceType,
    resourceId,
    metadata = {}
  }: ActivityLogParams): Promise<void> {
    try {
      const { error } = await supabase
        .from('activity_log')
        .insert({
          organization_id: organizationId,
          user_id: userId || null,
          action,
          resource_type: resourceType,
          resource_id: resourceId || null,
          metadata
        } as any)

      if (error) {
        console.error('Failed to log activity:', error)
        // Don't throw error to prevent disrupting main flow
      }
    } catch (err) {
      console.error('Activity logging error:', err)
    }
  }

  /**
   * Log multiple activities in a batch
   */
  static async logBatch(activities: ActivityLogParams[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('activity_log')
        .insert(
          activities.map(activity => ({
            organization_id: activity.organizationId,
            user_id: activity.userId || null,
            action: activity.action,
            resource_type: activity.resourceType,
            resource_id: activity.resourceId || null,
            metadata: activity.metadata || {}
          }))
        ) as any

      if (error) {
        console.error('Failed to log batch activities:', error)
      }
    } catch (err) {
      console.error('Batch activity logging error:', err)
    }
  }

  /**
   * Export-specific logging helpers
   */
  static async logExportStart(
    organizationId: string,
    userId: string,
    exportConfig: {
      name: string
      columns: string[]
      filters: Record<string, any>
      includeWriteBack: boolean
    }
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          action: 'export_start',
          resource_type: 'export',
          metadata: {
            ...exportConfig,
            status: 'preparing'
          }
        } as any)
        .select()
        .single()

      if (error) throw error
      return data?.id || null
    } catch (err) {
      console.error('Failed to log export start:', err)
      return null
    }
  }

  static async logExportComplete(
    exportId: string,
    metadata: {
      totalRecords: number
      processedRecords: number
      filePath: string
    }
  ): Promise<void> {
    try {
      await supabase
        .from('activity_log')
        .update({
          metadata: {
            status: 'completed',
            total_records: metadata.totalRecords,
            processed_records: metadata.processedRecords,
            file_path: metadata.filePath
          }
        } as any)
        .eq('id', exportId)
    } catch (err) {
      console.error('Failed to update export completion:', err)
    }
  }

  static async logExportError(
    exportId: string,
    error: string
  ): Promise<void> {
    try {
      await supabase
        .from('activity_log')
        .update({
          metadata: {
            status: 'failed',
            error
          }
        } as any)
        .eq('id', exportId)
    } catch (err) {
      console.error('Failed to update export error:', err)
    }
  }

  /**
   * Match-specific logging helpers
   */
  static async logMatchAction(
    organizationId: string,
    userId: string,
    action: 'match_approved' | 'match_rejected' | 'match_auto',
    matchId: string,
    metadata: {
      lineItemId: string
      productId?: string
      confidenceScore?: number
      reasoning?: string
    }
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action,
      resourceType: 'match',
      resourceId: matchId,
      metadata
    })
  }

  static async logBulkMatchAction(
    organizationId: string,
    userId: string,
    action: 'match_bulk_approved' | 'match_bulk_rejected',
    matchIds: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action,
      resourceType: 'match',
      metadata: {
        ...metadata,
        match_ids: matchIds,
        count: matchIds.length
      }
    })
  }

  /**
   * Document-specific logging helpers
   */
  static async logDocumentUpload(
    organizationId: string,
    userId: string,
    documentId: string,
    filename: string,
    fileSize: number
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action: 'document_uploaded',
      resourceType: 'document',
      resourceId: documentId,
      metadata: {
        filename,
        file_size: fileSize
      }
    })
  }

  static async logDocumentParsed(
    organizationId: string,
    documentId: string,
    metadata: {
      lineItemCount: number
      processingTime: number
      success: boolean
    }
  ): Promise<void> {
    await this.log({
      organizationId,
      action: metadata.success ? 'document_parsed' : 'document_failed',
      resourceType: 'document',
      resourceId: documentId,
      metadata
    })
  }

  /**
   * Product-specific logging helpers
   */
  static async logProductAction(
    organizationId: string,
    userId: string,
    action: 'product_created' | 'product_updated' | 'product_deleted',
    productId: string,
    metadata: {
      sku?: string
      name?: string
      changes?: string[]
    }
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action,
      resourceType: 'product',
      resourceId: productId,
      metadata
    })
  }

  /**
   * Settings-specific logging helpers
   */
  static async logSettingsChange(
    organizationId: string,
    userId: string,
    settingKey: string,
    oldValue: any,
    newValue: any
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action: 'settings_updated',
      resourceType: 'settings',
      resourceId: settingKey,
      metadata: {
        setting_key: settingKey,
        old_value: oldValue,
        new_value: newValue
      }
    })
  }

  /**
   * Get activity statistics for performance metrics
   */
  static async getActivityStats(
    organizationId: string,
    timeRange: { start: string; end: string }
  ): Promise<{
    totalActivities: number
    uniqueUsers: number
    actionBreakdown: Record<string, number>
  }> {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('action, user_id')
        .eq('organization_id', organizationId)
        .gte('created_at', timeRange.start)
        .lte('created_at', timeRange.end)

      if (error) throw error

      const activities = data || []
      const uniqueUsers = new Set(activities.filter((a: any) => a.user_id).map((a: any) => a.user_id)).size
      const actionBreakdown = activities.reduce((acc: any, activity: any) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        totalActivities: activities.length,
        uniqueUsers,
        actionBreakdown
      }
    } catch (err) {
      console.error('Failed to get activity stats:', err)
      return {
        totalActivities: 0,
        uniqueUsers: 0,
        actionBreakdown: {}
      }
    }
  }
}

/**
 * Convenience function for quick activity logging
 */
export async function logActivity(params: ActivityLogParams): Promise<void> {
  return ActivityLogger.log(params)
}

/**
 * React hook for activity logging with user context
 */
export function useActivityLogger(organizationId?: string, userId?: string) {
  const log = async (
    action: ActivityAction,
    resourceType: ResourceType,
    resourceId?: string,
    metadata?: Record<string, any>
  ) => {
    if (!organizationId) return

    await ActivityLogger.log({
      organizationId,
      userId,
      action,
      resourceType,
      resourceId,
      metadata
    })
  }

  const logBatch = async (activities: Array<{
    action: ActivityAction
    resourceType: ResourceType
    resourceId?: string
    metadata?: Record<string, any>
  }>) => {
    if (!organizationId) return

    await ActivityLogger.logBatch(
      activities.map(activity => ({
        organizationId,
        userId,
        ...activity
      }))
    )
  }

  return { log, logBatch }
}