import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/primitives/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-context";
import { useFiles, useUserSecretCode } from "@/components/files/use-files";
import { MyFilesTab } from "@/components/files/my-files-tab";
import { DownloadLogTab } from "@/components/files/download-log-tab";
import { StorageTab } from "@/components/files/storage-tab";

const title = "Secure files";
const description = "Upload, share and audit access to your secret-protected files.";

export const Route = createFileRoute("/_authenticated/files")({
  head: () => ({
    meta: [
      { title: `${title} — IntelliTrap` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FilesPage,
});

function FilesPage() {
  const { user } = useAuth();
  const filesQuery = useFiles(user?.id);
  const secretCodeQuery = useUserSecretCode(user?.id);
  const files = filesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      {!user ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <Tabs defaultValue="my-files" className="w-full">
          <TabsList>
            <TabsTrigger value="my-files">My Files</TabsTrigger>
            <TabsTrigger value="download-log">Download Log</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
          </TabsList>

          <TabsContent value="my-files" className="mt-4">
            {filesQuery.isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              <MyFilesTab
                files={files}
                userId={user.id}
                userSecretCode={secretCodeQuery.data ?? null}
                onRefresh={() => void filesQuery.refetch()}
              />
            )}
          </TabsContent>

          <TabsContent value="download-log" className="mt-4">
            <DownloadLogTab userId={user.id} />
          </TabsContent>

          <TabsContent value="storage" className="mt-4">
            <StorageTab files={files} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
