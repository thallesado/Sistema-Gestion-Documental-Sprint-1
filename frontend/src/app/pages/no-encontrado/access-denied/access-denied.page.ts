import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './access-denied.page.html',
  styleUrl: './access-denied.page.css',
})
export class AccessDeniedPage {}

export { AccessDeniedPage as AccesoDenegadoPage };
