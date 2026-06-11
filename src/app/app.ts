import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('period-app');
  protected readonly isLoading = signal(true);
  protected readonly randomQuote = signal('溫柔擁抱自己的每一個週期與情緒變化。');

  ngOnInit() {
    // Fetch random quotes from local quotes.json
    fetch('quotes.json')
      .then(res => res.json())
      .then((quotes: string[]) => {
        if (quotes && quotes.length > 0) {
          const randomIndex = Math.floor(Math.random() * quotes.length);
          this.randomQuote.set(quotes[randomIndex]);
        }
      })
      .catch(err => {
        console.warn('Could not load startup quotes, using default.', err);
      });

    // 1.5 seconds loading duration
    setTimeout(() => {
      this.isLoading.set(false);
    }, 1500);
  }
}
