import { LayoutDashboard, MessageSquare, Mail, Linkedin, Settings, Users, Search } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Reddit", url: "/reddit/discover", icon: MessageSquare, badge: "3" },
  { title: "Email", url: "/email", icon: Mail, badge: "1" },
  { title: "LinkedIn", url: "/linkedin", icon: Linkedin },
];

const secondaryNav = [
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const renderNavItem = (item: typeof mainNav[0] & { badge?: string }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end={item.url === "/dashboard"}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
            isActive(item.url)
              ? "bg-[hsl(var(--accent-light))] text-[hsl(var(--primary))] font-medium border-l-[3px] border-[hsl(var(--primary))] -ml-[3px] pl-[calc(0.75rem+3px)]"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
          activeClassName=""
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="flex-1">{item.title}</span>
          )}
          {!collapsed && item.badge && (
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--accent-light))] text-[hsl(var(--primary))]">
              {item.badge}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-[hsl(var(--surface-2))]">
      <SidebarContent className="pt-5">
        <div className="px-4 pb-4">
          <span className="font-mono text-lg font-bold tracking-tight text-foreground">
            Readout
          </span>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNav.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
