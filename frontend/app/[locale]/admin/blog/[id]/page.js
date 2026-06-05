"use client";

import { useParams } from "next/navigation";
import { ToastProvider } from "@/components/ui";
import BlogEditor from "@/components/admin/BlogEditor";

export default function EditBlogPostPage() {
  const params = useParams();
  return (
    <ToastProvider>
      <BlogEditor postId={params?.id} />
    </ToastProvider>
  );
}
