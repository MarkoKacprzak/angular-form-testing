import { Component } from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormGroup,
  NonNullableFormBuilder,
  Validators,
} from '@angular/forms';

import {
  EMPTY,
  merge,
  Subject,
  timer,
} from 'rxjs';
import {
  catchError,
  debounceTime,
  first,
  map,
  switchMap,
} from 'rxjs/operators';
import {
  PasswordStrength,
  Plan,
  SignupService,
} from 'src/app/services/signup.service';
import { addressLine2 } from 'src/app/spec-helpers/signup-data.spec-helper';

const { email, maxLength, pattern, required, requiredTrue } = Validators;

/**
 * Wait for this time before sending async validation requests to the server.
 */
const ASYNC_VALIDATION_DELAY = 1000;

@Component({
  selector: 'app-signup-form',
  templateUrl: './signup-form.component.html',
  styleUrls: ['./signup-form.component.scss'],
})
export class SignupFormComponent {
  public PERSONAL: Plan = 'personal';
  public BUSINESS: Plan = 'business';
  public NON_PROFIT: Plan = 'non-profit';

  private passwordSubject = new Subject<string>();
  private passwordStrengthFromServer$ = this.passwordSubject.pipe(
    debounceTime(ASYNC_VALIDATION_DELAY),
    switchMap((password) =>
      this.signupService.getPasswordStrength(password).pipe(catchError(() => EMPTY)),
    ),
  );
  public passwordStrength$ = merge(
    this.passwordSubject.pipe(map(() => null)),
    this.passwordStrengthFromServer$,
  );

  public showPassword = false;

  public form = this.formBuilder.group({
    plan: this.formBuilder.control<Plan>('personal', required),
    username: [
      '',
      [required, pattern('[a-zA-Z0-9.]+'), maxLength(50)],
      (control: AbstractControl) => this.validateUsername(control.value),
    ],
    email: [
      '',
      [required, email, maxLength(100)],
      (control: AbstractControl) => this.validateEmail(control.value),
    ],
    password: ['', required, () => this.validatePassword()],
    tos: [false, requiredTrue],
    address: this.formBuilder.group({
      name: ['', required],
      addressLine1: [''],
      addressLine2: ['', required ],// addressLine2: [{value: '', disabled: true}, required ],
      city: ['', required],
      postcode: ['', required],
      region: [''],
      country: ['', required],
    }),
  });

  test(){
    console.log(this.form);
    console.log(this.form.value);
    console.log(this.form.getRawValue());
   // this.addressLineLast.disable();
  }

  public plan = this.form.controls.plan;
  public addressLine1 = (this.form.controls.address as FormGroup).controls.addressLine1;
  public addressLineLast = (this.form.controls.address as FormGroup).controls.addressLine2;

  public passwordStrength?: PasswordStrength;

  public submitProgress: 'idle' | 'success' | 'error' = 'idle';

  constructor(
    private signupService: SignupService,
    private formBuilder: NonNullableFormBuilder,
  ) {
    this.plan.valueChanges.subscribe((plan) => {
      if (plan !== this.PERSONAL) {
        this.addressLine1.setValidators(required);
      } else {
        this.addressLine1.setValidators(null);
      }
      this.addressLine1.updateValueAndValidity();
    });
  }

  public getPasswordStrength(): void {
    const password = this.form.controls.password.value;
    if (password !== null) {
      this.passwordSubject.next(password);
    }
  }

  private validateUsername(username: string): ReturnType<AsyncValidatorFn> {
    return timer(ASYNC_VALIDATION_DELAY).pipe(
      switchMap(() => this.signupService.isUsernameTaken(username)),
      map((usernameTaken) => (usernameTaken ? { taken: true } : null)),
    );
  }

  private validateEmail(username: string): ReturnType<AsyncValidatorFn> {
    return timer(ASYNC_VALIDATION_DELAY).pipe(
      switchMap(() => this.signupService.isEmailTaken(username)),
      map((emailTaken) => (emailTaken ? { taken: true } : null)),
    );
  }

  private validatePassword(): ReturnType<AsyncValidatorFn> {
    return this.passwordStrength$.pipe(
      first((passwordStrength) => passwordStrength !== null),
      map((passwordStrength) =>
        passwordStrength && passwordStrength.score < 3 ? { weak: true } : null,
      ),
    );
  }

  public onSubmit(): void {
    if (!this.form.valid) return;
    this.signupService.signup(this.form.getRawValue()).subscribe({
      complete: () => {
        this.submitProgress = 'success';
      },
      error: () => {
        this.submitProgress = 'error';
      },
    });
  }
}
