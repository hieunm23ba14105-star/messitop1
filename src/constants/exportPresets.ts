export interface SizePreset {
  id: string
  label: string
  width: number
  height: number
  hint: string
}

export const sizePresets: SizePreset[] = [
  { id: "iphone-14-pro", label: "iPhone 14 Pro", width: 393, height: 852, hint: "Di động" },
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667, hint: "Nhỏ gọn" },
  { id: "android-standard", label: "Android Standard", width: 360, height: 800, hint: "Di động" },
  { id: "ipad", label: "iPad", width: 768, height: 1024, hint: "Máy tính bảng" },
  { id: "instagram-story", label: "Instagram Story", width: 1080, height: 1920, hint: "Mạng xã hội" },
  { id: "desktop", label: "Desktop", width: 1920, height: 1080, hint: "Màn rộng" },
]