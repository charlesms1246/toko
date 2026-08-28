import MenuDrawer from "@/components/menu/MenuDrawer";

export default function MenuLayout({ children }: LayoutProps<"/menu">) {
  return <MenuDrawer>{children}</MenuDrawer>;
}
