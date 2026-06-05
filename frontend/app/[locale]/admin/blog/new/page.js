"use client";

import { ToastProvider } from "@/components/ui";
import BlogEditor from "@/components/admin/BlogEditor";

export default function NewBlogPostPage() {
  return (
    <ToastProvider>
      <BlogEditor postId={null} />
    </ToastProvider>
  );
}
