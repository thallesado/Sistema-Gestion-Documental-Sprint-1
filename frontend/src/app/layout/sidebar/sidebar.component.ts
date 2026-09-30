import { CommonModule, UpperCasePipe } from '@angular/common';
import { Component, EventEmitter, Output, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavSection, Role } from '../../core/data/nexodocs-data';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, UpperCasePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  readonly collapsed = input<boolean>(false);
  readonly mobileOpen = input<boolean>(false);
  readonly tenantName = input<string>('');
  readonly role = input<Role>('Usuario basico');
  readonly displayName = input<string>('Usuario');
  readonly initials = input<string>('U');
  readonly availableSections = input<NavSection[]>([]);
  readonly currentUrl = input<string>('');
  readonly expanded = input<string[]>([]);

  @Output() readonly toggleCollapse = new EventEmitter<void>();
  @Output() readonly toggleNav = new EventEmitter<string>();
  @Output() readonly openNav = new EventEmitter<string>();
  @Output() readonly logout = new EventEmitter<void>();

  readonly menuOpen = signal(false);

  isActiveItem(label: string): boolean {
    const url = this.currentUrl();
    const section = this.availableSections().find((s) => s.items.some((i) => i.label === label));
    const item = section?.items.find((i) => i.label === label);
    return item?.children.some((c) => c.href === url) ?? false;
  }

  isExpanded(label: string): boolean {
    return this.expanded().includes(label);
  }

  navId(label: string): string {
    return `nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  onOpenNav(label: string): void {
    this.openNav.emit(label);
  }
}
