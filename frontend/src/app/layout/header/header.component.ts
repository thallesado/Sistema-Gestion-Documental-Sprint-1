import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  readonly mobileNavOpen = input<boolean>(false);
  readonly hideGlobalSearch = input<boolean>(false);
  readonly displayName = input<string>('Usuario');
  readonly initials = input<string>('U');

  @Output() readonly toggleMobileNav = new EventEmitter<void>();
  @Output() readonly logout = new EventEmitter<void>();

  readonly menuOpen = signal(false);
}
