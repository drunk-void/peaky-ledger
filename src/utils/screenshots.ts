import { createClient } from './supabase/client'
import { Screenshot } from '@/types/journal'
import imageCompression from 'browser-image-compression'

export async function uploadScreenshot(
  file: File,
  userId: string,
  tradeId?: string,
  diaryEntryId?: string,
  caption?: string
): Promise<Screenshot> {
  const supabase = createClient()
  
  // Compress image
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  }
  
  let compressedFile = file
  try {
    compressedFile = await imageCompression(file, options)
  } catch (err) {
    console.error('Image compression failed, using original file', err)
  }
  
  // Generate a unique path: userId/timestamp-random.ext
  const fileExt = file.name.split('.').pop() || 'png'
  const randomId = Math.random().toString(36).substring(2, 15)
  const path = `${userId}/${Date.now()}-${randomId}.${fileExt}`
  
  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('screenshots')
    .upload(path, compressedFile, {
      cacheControl: '3600',
      upsert: false,
    })
    
  if (uploadError) {
    throw uploadError
  }
  
  // Insert metadata into database
  const { data: dbData, error: dbError } = await supabase
    .from('screenshots')
    .insert({
      user_id: userId,
      trade_id: tradeId || null,
      diary_entry_id: diaryEntryId || null,
      storage_path: path,
      file_size: compressedFile.size,
      original_size: file.size,
      caption: caption || null,
    })
    .select()
    .single()
    
  if (dbError) {
    // If db insert fails, try to clean up the uploaded storage object
    await supabase.storage.from('screenshots').remove([path])
    throw dbError
  }
  
  return dbData as Screenshot
}

export async function getScreenshots(
  tradeId?: string,
  diaryEntryId?: string
): Promise<(Screenshot & { publicUrl: string })[]> {
  const supabase = createClient()
  
  let query = supabase.from('screenshots').select('*')
  
  if (tradeId) {
    query = query.eq('trade_id', tradeId)
  } else if (diaryEntryId) {
    query = query.eq('diary_entry_id', diaryEntryId)
  } else {
    return []
  }
  
  const { data, error } = await query
  if (error) {
    throw error
  }
  
  // Generate public URLs for each screenshot
  return data.map((screenshot) => {
    const { data: { publicUrl } } = supabase.storage
      .from('screenshots')
      .getPublicUrl(screenshot.storage_path)
      
    return {
      ...(screenshot as Screenshot),
      publicUrl,
    }
  })
}

export async function deleteScreenshot(id: string, storagePath: string): Promise<void> {
  const supabase = createClient()
  
  // 1. Delete from Storage
  const { error: storageError } = await supabase.storage
    .from('screenshots')
    .remove([storagePath])
    
  if (storageError) {
    console.error('Failed to remove from storage, continuing to delete metadata', storageError)
  }
  
  // 2. Delete from DB
  const { error: dbError } = await supabase
    .from('screenshots')
    .delete()
    .eq('id', id)
    
  if (dbError) {
    throw dbError
  }
}
