import { Plus } from 'lucide-react'
import Link from 'next/link'
import { BodyTemplate } from '@/components/layout/body-template'
import EmptyState from '@/components/layout/empty-state'
import { MainContent } from '@/components/layout/main-content'
import { PageHeader } from '@/components/layout/page-header'
import { MCPToolsList } from '@/components/mcp-servers/mcp-tools-list'
import { Button } from '@/components/ui/button'
import { fetchMCPTools } from '@/lib/api/tools'
import type { MCPTool } from '@/lib/types/tools'

const mcpServerDescription = 'Create MCP servers that agents can use to access external services.'

async function MCPServersPage({
  params,
}: {
  params: Promise<{ tenantId: string; projectId: string }>
}) {
  const { tenantId, projectId } = await params
  let tools: MCPTool[] = []
  try {
    tools = await fetchMCPTools(tenantId, projectId)
  } catch (error) {
    console.error('Failed to load MCP tools:', error)
  }

  return (
    <BodyTemplate breadcrumbs={[{ label: 'MCP servers' }]}>
      <MainContent className="min-h-full">
        {tools.length > 0 ? (
          <>
            <PageHeader
              title="MCP servers"
              description={mcpServerDescription}
              action={
                <Button asChild>
                  <Link
                    href={`/${tenantId}/projects/${projectId}/mcp-servers/new`}
                    className="flex items-center gap-2"
                  >
                    <Plus className="size-4" />
                    New MCP server
                  </Link>
                </Button>
              }
            />
            <MCPToolsList tools={tools} />
          </>
        ) : (
          <EmptyState
            title="No MCP servers yet."
            description={mcpServerDescription}
            link={`/${tenantId}/projects/${projectId}/mcp-servers/new`}
            linkText="Create MCP server"
          />
        )}
      </MainContent>
    </BodyTemplate>
  )
}

export default MCPServersPage
