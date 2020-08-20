package controllers

import javax.inject.{Inject, Singleton}
import models.UserStatus
import org.elastic4play.controllers.{Authenticated, Fields, FieldsBodyParser}
import org.elastic4play.database.DBIndex
import org.elastic4play.services.AuthSrv
import org.elastic4play.{AuthorizationError, Timed}
import play.api.Configuration
import play.api.mvc._
import services.UserSrv

import scala.concurrent.{ExecutionContext, Future}

@Singleton
class AuthenticationCtrl @Inject()(
    configuration: Configuration,
    authSrv: AuthSrv,
    userSrv: UserSrv,
    authenticated: Authenticated,
    dbIndex: DBIndex,
    components: ControllerComponents,
    fieldsBodyParser: FieldsBodyParser,
    implicit val ec: ExecutionContext
) extends AbstractController(components) {

  @Timed
  def login: Action[Fields] = Action.async(fieldsBodyParser) { implicit request ⇒
    dbIndex.getIndexStatus.flatMap {
      case false ⇒ Future.successful(Results.Status(520))
      case _ ⇒
        for {
          authContext ← authSrv.authenticate(request.body.getString("user").getOrElse("TODO"), request.body.getString("password").getOrElse("TODO"))
          user        ← userSrv.get(authContext.userId)
        } yield {
          if (user.status() == UserStatus.Ok)
            authenticated.setSessingUser(Ok, authContext)
          else
            throw AuthorizationError("Your account is locked")
        }
    }
  }

  @Timed
  def ssoLogin: Action[AnyContent] = Action.async { implicit request ⇒
    dbIndex.getIndexStatus.flatMap {
      case false ⇒ Future.successful(Results.Status(520))
      case _ ⇒
        authSrv
          .authenticate()
          .flatMap {
            case Right(authContext) ⇒
              userSrv.get(authContext.userId).map { user ⇒
                if (user.status() == UserStatus.Ok)
                  authenticated.setSessingUser(Redirect(configuration.get[String]("play.http.context").stripSuffix("/") + "/index.html"), authContext)
                else
                  throw AuthorizationError("Your account is locked")
              }
            case Left(result) ⇒ Future.successful(result)
          }
    }
  }

  @Timed
  def logout: Action[AnyContent] = Action {
    Ok.withNewSession
  }
}
