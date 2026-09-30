import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './no-encontrado.page.html',
  styleUrl: './no-encontrado.page.css',
})
export class NotFoundPage {}

export { NotFoundPage as NoEncontradoPage };
