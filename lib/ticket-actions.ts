'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Every action below needs the caller's id for RLS to evaluate
 * correctly (auth.uid()) this just centralizes "get the client, get
 * the user, fail loudly if there isn't one" so it isn't repeated in
 * every function.
 */
async function getSupabaseAndUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not signed in')
  }
  return { supabase, user }
}

//
// Creation
//

export async function createDraftTicket(formData: FormData) {
  const { supabase } = await getSupabaseAndUser()

  const employeeNo = formData.get('employee_no') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const categoryId = formData.get('category_id') as string
  const priority = (formData.get('priority') as string) || undefined

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_no', employeeNo)
    .eq('is_active', true)
    .single()

  if (employeeError || !employee) {
    throw new Error(`Employee ${employeeNo} not found or inactive`)
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      requester_id: employee.id,
      title,
      description,
      category_id: categoryId,
      priority
    })
    .select('id, ticket_number')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/tickets')
  return ticket
}

//
// QR-driven transitions
//

export async function confirmTicketCreation(ticketId: string, scannedEmployeeNo: string) {
  const { supabase } = await getSupabaseAndUser()
  
  const { error } = await supabase.rpc('confirm_ticket_creation_via_qr', {
    _ticket_id: ticketId,
    _scanned_employee_no: scannedEmployeeNo,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/tickets/${ticketId}`)
}

export async function closeTicketViaQr(ticketId: string, scannedEmployeeNo: string) {
  const { supabase } = await getSupabaseAndUser()

  const { error } = await supabase.rpc('close_ticket_via_qr', {
    _ticket_id: ticketId,
    _scanned_employee_no: scannedEmployeeNo,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/tickets/${ticketId}`)
}

//
// Manual staff actions
//

const VALID_STATUSES = [
  'open',
  'in_progress',
  'on_hold',
  'resolved',
  'reopened',
] as const

type ManualStatus = (typeof VALID_STATUSES)[number]

export async function updateTicketStatus(ticketId: string, status: ManualStatus) {
  const { supabase } = await getSupabaseAndUser()

  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`)
  }

  const timestamps: Record<string, string> =
    status === 'resolved'
      ? { resolved_at: new Date().toISOString() }
      : {}

  const { error } = await supabase
    .from('tickets')
    .update({ status, ...timestamps })
    .eq('id', ticketId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/tickets/${ticketId}`)
}

export async function assignTicket(ticketId: string, assigneeId: string | null) {
  const { supabase } = await getSupabaseAndUser()

  const { error } = await supabase
    .from('tickets')
    .update({ assigned_to_id: assigneeId })
    .eq('id', ticketId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath(`/tickets`)
}

export async function overrideCloseTicket(ticketId: string, reason?: string) {
  const { supabase } = await getSupabaseAndUser()

  const { error } = await supabase.rpc('override_close_ticket', {
    _ticket_id: ticketId,
    _reason: reason ?? null,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/tickets/${ticketId}`)
}

//
// Comments
//

export async function postComment(ticketId: string, body: string, isInternal: boolean) {
  const { supabase, user } = await getSupabaseAndUser()

  const { error } = await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    user_id: user.id,
    body,
    is_internal: isInternal,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/tickets/${ticketId}`)
}

//
// Attachments
//

export async function uploadAttachment(ticketId: string, formData: FormData) {
  const { supabase, user } = await getSupabaseAndUser()

  const file = formData.get('file') as File
  if (!file) {
    throw new Error('No file provided')
  }

  const storagePath = `${ticketId}/${crypto.randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('ticket-attachments')
    .upload(storagePath, file)

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { error: insertError } = await supabase.from('ticket_attachments').insert({
    tickets_id: ticketId,
    uploaded_by_id: user.id,
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
  })

  if (insertError) {
    await supabase.storage.from('ticket-attachments').remove([storagePath])
    throw new Error(insertError.message)
  }

  revalidatePath(`/tickets/${ticketId}`)
}

export async function deleteAttachment(
  ticketId: string,
  attachmentId: string,
  storagePath: string
) {
  const { supabase } = await getSupabaseAndUser()

  const { data: deletedRows, error: deleteRowError } = await supabase
    .from('ticket_attachments')
    .delete()
    .eq('id', attachmentId)
    .select('id')

  if (deleteRowError) throw new Error(deleteRowError.message)

  if (!deletedRows || deletedRows.length === 0) {
    throw new Error(
      'Attachment cannot be deleted — the ticket is no longer awaiting confirmation.'
    )
  }

  const { error: deleteFileError } = await supabase.storage
    .from('ticket-attachments')
    .remove([storagePath])

  if (deleteFileError) throw new Error(deleteFileError.message)

  revalidatePath(`/tickets/${ticketId}`)
}