import { useEffect, useRef, useState } from "react"
import type { Message } from "@/types/message"
import type { Participant } from "@/types/conversation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/utils/cn"
import { readFileAsDataUrl } from "@/utils/helpers"
import { Clipboard, ImagePlus, X } from "lucide-react"

interface MessageFormProps {
  participants: Participant[]
  initial?: Message | null
  defaultSenderId?: string
  compact?: boolean
  resetOnSubmit?: boolean
  submitLabel?: string
  advancedOpen?: boolean
  onToggleAdvanced?: () => void
  onSubmit: (payload: {
    senderId: string
    content: string
    imageUrl?: string
    timestamp: string
    type: Message["type"]
    status: Message["status"]
  }) => void
  onCancel?: () => void
}

const resolveSenderId = (preferredId: string | undefined, participants: Participant[]) => {
  if (preferredId && participants.some((participant) => participant.id === preferredId)) {
    return preferredId
  }
  return participants[0]?.id ?? ""
}

const toInputValue = (iso: string) => {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const fromInputValue = (value: string) => new Date(value).toISOString()

export const MessageForm = ({
  participants,
  initial,
  defaultSenderId,
  compact,
  resetOnSubmit,
  submitLabel,
  advancedOpen,
  onToggleAdvanced,
  onSubmit,
  onCancel,
}: MessageFormProps) => {
  const [content, setContent] = useState(initial?.content ?? "")
  const [senderId, setSenderId] = useState(
    initial?.senderId ?? resolveSenderId(defaultSenderId, participants),
  )
  const [timestamp, setTimestamp] = useState(
    initial?.timestamp ? toInputValue(initial.timestamp) : toInputValue(new Date().toISOString()),
  )
  const [type, setType] = useState<Message["type"]>(initial?.type ?? "text")
  const [status, setStatus] = useState<Message["status"]>(initial?.status ?? "sent")
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "")
  const [imageError, setImageError] = useState<string | null>(null)
  const showAdvanced = advancedOpen ?? true
  const showAdvancedToggle = typeof advancedOpen === "boolean" && typeof onToggleAdvanced === "function"
  const previousDefaultRef = useRef(defaultSenderId)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (initial) return
    const previousDefault = previousDefaultRef.current
    previousDefaultRef.current = defaultSenderId
    const nextDefault = resolveSenderId(defaultSenderId, participants)
    setSenderId((current) => {
      const isValid = participants.some((participant) => participant.id === current)
      if (!current || !isValid || current === previousDefault) {
        return nextDefault
      }
      return current
    })
  }, [defaultSenderId, initial, participants])

  const insertAtCursor = (text: string) => {
    const element = textareaRef.current
    if (!element) {
      setContent((current) => (current ? `${current}\n${text}` : text))
      return
    }
    const start = element.selectionStart ?? element.value.length
    const end = element.selectionEnd ?? element.value.length
    setContent((current) => current.slice(0, start) + text + current.slice(end))
    requestAnimationFrame(() => {
      element.focus()
      const nextPos = start + text.length
      element.setSelectionRange(nextPos, nextPos)
    })
  }

  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          insertAtCursor(text)
          return
        }
      }
    } catch (error) {
      console.error("Paste failed", error)
    }
    const fallback = window.prompt("Dán nội dung tin nhắn")
    if (fallback) insertAtCursor(fallback)
  }

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImageError("Chỉ cho phép tệp hình ảnh.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Ảnh phải nhỏ hơn 5MB.")
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setImageUrl(dataUrl)
      setImageError(null)
    } catch (error) {
      console.error("Failed to read image file", error)
      setImageError("Không thể đọc ảnh đã chọn.")
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (type === "image" && !imageUrl) {
          setImageError("Vui lòng tải ảnh lên cho tin nhắn này.")
          return
        }
        onSubmit({
          senderId,
          content,
          imageUrl: type === "image" ? imageUrl : undefined,
          timestamp: fromInputValue(timestamp),
          type,
          status,
        })
        if (resetOnSubmit && !initial) {
          setContent("")
          setTimestamp(toInputValue(new Date().toISOString()))
          setType("text")
          setStatus("sent")
          setSenderId(resolveSenderId(defaultSenderId, participants))
          setImageUrl("")
          setImageError(null)
        }
      }}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{type === "image" ? "Chú thích" : "Tin nhắn"}</Label>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={handlePaste}>
              <Clipboard className="h-3.5 w-3.5" />
              Dán
            </Button>
            {content ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setContent("")}>
                <X className="h-3.5 w-3.5" />
                Xoá
              </Button>
            ) : null}
          </div>
        </div>
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={type === "image" ? "Thêm chú thích (không bắt buộc)..." : "Nhập nội dung tin nhắn..."}
          className={cn(compact && "min-h-[72px]")}
        />
      </div>

      {type === "image" ? (
        <div className="space-y-2">
          <Label>Tải ảnh lên</Label>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="h-20 w-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {imageUrl ? (
                <img src={imageUrl} alt="Ảnh xem trước" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Chưa có ảnh
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <ImagePlus className="h-4 w-4" />
                Chọn ảnh
              </Button>
              {imageUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")}>
                  Xoá ảnh
                </Button>
              ) : null}
              <span className="text-xs text-slate-500">JPG, PNG hoặc WEBP tối đa 5MB.</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                await handleImageUpload(file)
                event.target.value = ""
              }}
            />
          </div>
          {imageError ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {imageError}
            </div>
          ) : null}
        </div>
      ) : null}

      {showAdvanced ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Người gửi</Label>
              <Select value={senderId} onValueChange={setSenderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn người gửi" />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((participant) => (
                    <SelectItem key={participant.id} value={participant.id}>
                      {participant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Thời gian</Label>
              <Input
                type="datetime-local"
                value={timestamp}
                onChange={(event) => setTimestamp(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Loại</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  const nextType = value as Message["type"]
                  setType(nextType)
                  if (nextType !== "image") {
                    setImageError(null)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại tin nhắn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Văn bản</SelectItem>
                  <SelectItem value="system">Hệ thống</SelectItem>
                  <SelectItem value="image">Hình ảnh</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as Message["status"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sent">Đã gửi</SelectItem>
                  <SelectItem value="delivered">Đã nhận</SelectItem>
                  <SelectItem value="read">Đã xem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          disabled={type === "image" && !imageUrl}
          onClick={() => {
            if (type === "image" && !imageUrl) {
              setImageError("Vui lòng tải ảnh lên cho tin nhắn này.")
            }
          }}
        >
          {submitLabel ?? (initial ? "Lưu thay đổi" : "Thêm tin nhắn")}
        </Button>
        {initial ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Huỷ
          </Button>
        ) : null}
        {showAdvancedToggle ? (
          <Button type="button" variant="ghost" onClick={onToggleAdvanced}>
            {advancedOpen ? "Ẩn nâng cao" : "Nâng cao"}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
