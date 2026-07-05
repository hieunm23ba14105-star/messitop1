import { ImagePlus, Minus, PaintBucket, Plus, ScreenShare } from "lucide-react"
import { layoutConfigs } from "@/constants/layouts"
import { useConversationStore } from "@/store/conversationStore"
import { LayoutSelector } from "@/components/layout/LayoutSelector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { clamp, getConversationTitle, readFileAsDataUrl } from "@/utils/helpers"

export const SettingsPanel = () => {
  const layoutId = useConversationStore((state) => state.layoutId)
  const themeId = useConversationStore((state) => state.themeId)
  const setTheme = useConversationStore((state) => state.setTheme)
  const ui = useConversationStore((state) => state.ui)
  const setUi = useConversationStore((state) => state.setUi)
  const conversation = useConversationStore((state) => state.conversation)
  const setGroupName = useConversationStore((state) => state.setGroupName)
  const backgroundImageUrl = useConversationStore((state) => state.backgroundImageUrl)
  const backgroundImageOpacity = useConversationStore((state) => state.backgroundImageOpacity)
  const setBackgroundImageUrl = useConversationStore((state) => state.setBackgroundImageUrl)
  const setBackgroundImageOpacity = useConversationStore((state) => state.setBackgroundImageOpacity)
  const clearBackgroundImage = useConversationStore((state) => state.clearBackgroundImage)
  const backgroundColor = useConversationStore((state) => state.backgroundColor)
  const setBackgroundColor = useConversationStore((state) => state.setBackgroundColor)

  const isGroup = conversation.participants.length > 2
  const title = getConversationTitle(conversation)

  const layout = layoutConfigs.find((item) => item.id === layoutId) ?? layoutConfigs[0]
  const hasDark = layout.themes.some((theme) => theme.id === "dark")
  const isDark = themeId === "dark"

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Giao diện & xem trước</h3>
        <p className="text-xs text-slate-500">Tuỳ chỉnh bố cục, chủ đề và cách hiển thị xem trước.</p>
      </div>

      <div className="space-y-2">
        <Label>Bố cục</Label>
        <LayoutSelector />
      </div>

      <div className="space-y-2">
        <Label>{isGroup ? "Tên nhóm" : "Cuộc trò chuyện"}</Label>
        {isGroup ? (
          <Input
            value={conversation.groupName ?? ""}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Nhập tên nhóm"
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {title}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div>
          <div className="text-sm font-medium text-slate-900">Chủ đề</div>
          <div className="text-xs text-slate-500">Chuyển giữa giao diện sáng và tối.</div>
        </div>
        <Switch
          checked={isDark}
          onCheckedChange={(value) => setTheme(value && hasDark ? "dark" : "light")}
          disabled={!hasDark}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div>
          <div className="text-sm font-medium text-slate-900">Khung giao diện</div>
          <div className="text-xs text-slate-500">Hiển thị thanh đầu và ô nhập tin nhắn.</div>
        </div>
        <Switch checked={ui.showChrome} onCheckedChange={(value) => setUi({ showChrome: value })} />
      </div>

      <div className="space-y-2">
        <Label>Thu phóng</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUi({ zoom: clamp(ui.zoom - 0.1, 0.5, 2) })}
          >
            <Minus className="h-4 w-4" />
            Thu nhỏ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUi({ zoom: clamp(ui.zoom + 0.1, 0.5, 2) })}
          >
            <Plus className="h-4 w-4" />
            Phóng to
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setUi({ zoom: 1 })}>
            <ScreenShare className="h-4 w-4" />
            Đặt lại
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div>
          <div className="text-sm font-medium text-slate-900">Tự khớp khung xem trước</div>
          <div className="text-xs text-slate-500">Tự co giãn để vừa vùng xem trước.</div>
        </div>
        <Switch checked={ui.autoFit} onCheckedChange={(value) => setUi({ autoFit: value })} />
      </div>

      <div className="space-y-2">
        <Label>Ảnh nền</Label>
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <div className="h-24 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              {backgroundImageUrl ? (
                <img src={backgroundImageUrl} alt="Xem trước ảnh nền" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-slate-400">
                  <ImagePlus className="h-4 w-4" />
                  Chưa có ảnh
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-center gap-2">
                <label htmlFor="bg-upload" className="flex cursor-pointer items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Tải ảnh lên
                </label>
              </Button>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Chỉ dùng ảnh tải lên (xuất ảnh ổn định hơn)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearBackgroundImage}
                  disabled={!backgroundImageUrl}
                >
                  Xoá
                </Button>
              </div>
              <input
                id="bg-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  try {
                    const dataUrl = await readFileAsDataUrl(file)
                    setBackgroundImageUrl(dataUrl)
                  } catch (error) {
                    console.error("Failed to read background file", error)
                  }
                  event.target.value = ""
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Độ mờ ảnh nền</Label>
            <div className="flex items-center gap-3">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[Math.round(backgroundImageOpacity * 100)]}
                onValueChange={(value) =>
                  setBackgroundImageOpacity(clamp(Number(value[0]) / 100, 0, 1))
                }
                className="flex-1"
                disabled={!backgroundImageUrl}
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={Math.round(backgroundImageOpacity * 100)}
                onChange={(event) =>
                  setBackgroundImageOpacity(clamp(Number(event.target.value) / 100, 0, 1))
                }
                className="w-20"
                disabled={!backgroundImageUrl}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Màu nền</Label>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <PaintBucket className="h-4 w-4 text-slate-500" />
            <span className="text-xs text-slate-500">Tô nền</span>
          </div>
          <Input
            type="color"
            value={backgroundColor || layout.themes.find((t) => t.id === themeId)?.colors.background || "#ffffff"}
            onChange={(event) => setBackgroundColor(event.target.value)}
            className="h-10 w-14 p-1"
          />
          <Input
            type="text"
            value={backgroundColor}
            onChange={(event) => setBackgroundColor(event.target.value)}
            placeholder={layout.themes.find((t) => t.id === themeId)?.colors.background || "#ffffff"}
            className="max-w-[180px]"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBackgroundColor("")}
            disabled={!backgroundColor}
          >
            Đặt lại
          </Button>
        </div>
      </div>
    </div>
  )
}
